import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ToolRegistryService } from '../../tools/tool-registry.service.js';
import { SelfHealingService } from '../../ai/self-healing.service.js';
import { ArtifactService } from '../../artifact/artifact.service.js';
import { TranscriptEngineService } from './transcript-engine.service.js';
import {
  WorkspaceRunStateService,
  WorkspaceStreamEvent,
  WorkspaceRunState,
} from './workspace-run-state.service.js';
import { ToolResultFormatter } from '../../tools/utils/tool-result-formatter.js';
import { ToolResult } from '../../tools/interfaces/tool-result.interface.js';
import {
  extractLooseArguments,
  hasExplicitDeleteIntent,
} from '../utils/tool-call-extractor.util.js';
import * as path from 'path';

const VERIFY_TAIL_MS = 90_000;

export interface ToolExecutionRoundContext {
  workspaceId: string;
  sessionId: string;
  safeGoal: string;
  workspaceRootPath: string;
  runState: WorkspaceRunState;
  tools: any[];
  messages: any[];
  mutationsApplied: number;
  noProgressRounds: number;
  runStartTime: number;
  touchedFiles: Set<string>;
  createdArtifactIds: string[];
}

export interface ToolExecutionRoundResult {
  executedToolCount: number;
  mutationsApplied: number;
  noProgressRounds: number;
  concludeRun: boolean;
  concludeContent?: string;
}

@Injectable()
export class WorkspaceToolExecutorService {
  private readonly logger = new Logger(WorkspaceToolExecutorService.name);

  constructor(
    @Inject(forwardRef(() => ToolRegistryService))
    private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => SelfHealingService))
    private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => ArtifactService))
    private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => TranscriptEngineService))
    private readonly transcriptEngine: TranscriptEngineService,
    @Inject(forwardRef(() => WorkspaceRunStateService))
    private readonly stateService: WorkspaceRunStateService,
  ) {}

  async executeRoundTools(
    toolCalls: any[],
    context: ToolExecutionRoundContext,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): Promise<ToolExecutionRoundResult> {
    const {
      workspaceId,
      sessionId,
      safeGoal,
      workspaceRootPath,
      runState,
      tools,
      messages,
      runStartTime,
      touchedFiles,
      createdArtifactIds,
    } = context;

    let mutationsApplied = context.mutationsApplied;
    let noProgressRounds = context.noProgressRounds;
    let executedToolCount = 0;
    const roundMutationsStart = mutationsApplied;

    // Update phase based on tool types
    const hasReadTools = toolCalls.some((tc) =>
      ['search_workspace', 'read', 'list'].includes(tc.function?.name),
    );
    const hasWriteTools = toolCalls.some((tc) =>
      [
        'write',
        'generate_export',
        'draft_communication',
        'edit',
        'delete',
        'rename',
      ].includes(tc.function?.name),
    );
    if (hasReadTools) this.stateService.setPhase(runState, 'reading', onEvent);
    if (hasWriteTools)
      this.stateService.setPhase(runState, 'generating', onEvent);

    const declaredTools = new Set(tools.map((t) => t.function?.name || ''));
    declaredTools.add('ask_user');
    declaredTools.add('agent_spawn');
    declaredTools.add('todo_write');
    declaredTools.add('batch_execute');
    declaredTools.add('multi_doc_process');

    const readOnlyCalls: Array<{
      toolCall: any;
      args: Record<string, any>;
    }> = [];
    const mutatingCalls: Array<{
      toolCall: any;
      args: Record<string, any>;
    }> = [];

    for (const toolCall of toolCalls) {
      const funcName = toolCall.function?.name;
      let args: Record<string, any> = {};
      const rawArgsRaw = toolCall.function?.arguments || '';
      try {
        const rawArgs = rawArgsRaw || '{}';
        try {
          args = JSON.parse(rawArgs);
        } catch {
          const cleaned = rawArgs.replace(
            /[\u0000-\u001F]+/g,
            (match: string) => {
              if (match === '\n') return '\\n';
              if (match === '\r') return '\\r';
              if (match === '\t') return '\\t';
              return '';
            },
          );
          args = JSON.parse(cleaned);
        }
      } catch {
        args = extractLooseArguments(rawArgsRaw);
        if (Object.keys(args).length > 0) {
          this.logger.log(
            `[tool-call] ${funcName} recovered arguments using loose extraction: ${JSON.stringify(Object.keys(args))}`,
          );
        } else {
          this.logger.warn(
            `[tool-call] ${funcName} JSON.parse failed and loose extraction found 0 keys. Raw arguments: ${JSON.stringify(rawArgsRaw.slice(0, 300))}`,
          );
        }
      }
      if (
        Object.keys(args).length === 0 &&
        rawArgsRaw.length > 0 &&
        rawArgsRaw !== '{}'
      ) {
        args = extractLooseArguments(rawArgsRaw);
      }

      if (!declaredTools.has(funcName)) {
        this.logger.warn(
          `Rejected undeclared tool call "${funcName}" (not in active tool subset).`,
        );
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content:
            `Error: tool "${funcName}" is not available for this task. ` +
            `Available tools: [${[...declaredTools].join(', ')}]. ` +
            'Use one of those tools.',
        });
        continue;
      }

      if (
        this.toolRegistryService.isMutating(funcName) &&
        Object.keys(args).length === 0
      ) {
        if (
          mutationsApplied > 0 &&
          noProgressRounds >= 2 &&
          Date.now() - runStartTime > VERIFY_TAIL_MS
        ) {
          return {
            executedToolCount,
            mutationsApplied,
            noProgressRounds,
            concludeRun: true,
            concludeContent: 'Autonomous workspace task completed.',
          };
        }
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content:
            `Error: tool "${funcName}" was called without any arguments. ` +
            (funcName === 'edit'
              ? 'edit requires "filePath" plus (patchText OR oldString+newString) to act. '
              : `${funcName} requires its target fields (e.g. "filePath") to act. `) +
            (mutationsApplied > 0
              ? 'The requested changes appear to already be applied. If all changes are done, reply with your final summary text and do NOT call any more tools.'
              : 'Reissue the tool call with the required fields.'),
        });
        continue;
      }

      if (this.toolRegistryService.isMutating(funcName)) {
        executedToolCount++;
        mutatingCalls.push({ toolCall, args });
      } else {
        readOnlyCalls.push({ toolCall, args });
      }
    }

    // Fast Cut-off:
    if (
      mutationsApplied > 0 &&
      mutatingCalls.length === 0 &&
      readOnlyCalls.length > 0
    ) {
      const allKnownTargets = readOnlyCalls.every(({ args: ra }) => {
        const base = path
          .basename(String(ra.filename || ra.path || ra.filePath || ''))
          .toLowerCase();
        return !base || touchedFiles.has(base);
      });
      if (allKnownTargets) {
        this.logger.log(
          `[Fast Cut-Off] Round ${runState.round} only re-reads already-touched file(s) after ${mutationsApplied} successful mutation(s) — concluding run instantly.`,
        );
        return {
          executedToolCount,
          mutationsApplied,
          noProgressRounds,
          concludeRun: true,
          concludeContent:
            'Document changes successfully applied and verified.',
        };
      }
    }

    // Execute read-only tools in parallel
    if (readOnlyCalls.length > 0) {
      onEvent({
        type: 'tool_start',
        data: {
          toolName: `parallel (${readOnlyCalls.map((c) => c.toolCall.function.name).join(', ')})`,
          args: {},
          timestamp: new Date().toISOString(),
        },
      });

      const healedResults = await Promise.all(
        readOnlyCalls.map(async ({ toolCall, args }) => {
          const enrichedArgs = { ...args, workspaceId };
          const result = await this.selfHealingService.executeWithIsolation(
            toolCall.function.name,
            enrichedArgs,
            workspaceId,
          );
          return { toolCall, args, result };
        }),
      );

      for (const { toolCall, args, result } of healedResults) {
        if (result.status === 'success' && result.metadata?.contentBase64) {
          const artifact = await this.artifactService.createFromAgent({
            workspaceId,
            type:
              result.metadata.format === 'xlsx' ||
              result.metadata.format === 'csv'
                ? 'spreadsheet'
                : 'document',
            name:
              result.metadata.filename || `workspace-output-${Date.now()}.file`,
            mimeType: result.metadata.mimeType || 'application/octet-stream',
            contentBase64: result.metadata.contentBase64,
            preview: result.preview,
            data: result.data,
            createdBy: `workspace-agent:${toolCall.function.name}`,
            tags: [
              `workspace:${workspaceId}`,
              `tool:${toolCall.function.name}`,
            ],
            lineage: [toolCall.function.name],
          });
          createdArtifactIds.push(artifact.id);
        }

        onEvent({
          type: 'tool_done',
          data: {
            toolName: toolCall.function.name,
            result,
            timestamp: new Date().toISOString(),
          },
        });

        if (
          ['search_workspace', 'read', 'list'].includes(toolCall.function.name)
        ) {
          this.stateService.trackReadFile(
            workspaceId,
            args.filename || args.path || 'unknown',
          );
          if (result.status === 'success') {
            const rf = String(
              args.filename || args.path || args.filePath || '',
            );
            if (rf) touchedFiles.add(path.basename(rf).toLowerCase());
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: ToolResultFormatter.formatForLlm(
            toolCall.function.name,
            result,
          ),
        });
      }
    }

    // Execute mutating tools serially
    for (const { toolCall, args } of mutatingCalls) {
      const funcName = toolCall.function.name;
      this.logger.log(
        `Auto-executing workspace tool: ${funcName} (${args.filename || args.keys || ''})`,
      );

      onEvent({
        type: 'tool_start',
        data: {
          toolName: funcName,
          args,
          timestamp: new Date().toISOString(),
        },
      });

      let result: ToolResult;
      try {
        const mentionedFiles = this.stateService.getMentionedFiles(workspaceId);
        const rawTargetName = String(args.filename || args.filePath || '');
        const targetBasename = path.basename(rawTargetName).toLowerCase();
        const isMentioned = [...mentionedFiles].some(
          (name) => path.basename(name).toLowerCase() === targetBasename,
        );
        if (mentionedFiles.size > 0 && funcName === 'write' && !isMentioned) {
          throw new Error(
            'A file referenced with @ must be the update target.',
          );
        }
        if (isMentioned && ['delete', 'rename'].includes(funcName)) {
          throw new Error(
            'Files referenced with @ cannot be deleted or renamed during an edit run.',
          );
        }
        if (
          funcName === 'delete' &&
          !hasExplicitDeleteIntent(safeGoal, rawTargetName)
        ) {
          throw new Error(
            'Deletion denied: the instruction must explicitly ask to delete and name the target file.',
          );
        }
        if (
          typeof args.content === 'string' &&
          /@[^\s@]+\.[A-Za-z0-9]{1,10}/.test(args.content)
        ) {
          throw new Error(
            'Content still contains raw @file references and cannot be saved.',
          );
        }
        const enrichedArgs: Record<string, any> = {
          ...args,
          workspaceId,
          rootPath: workspaceRootPath,
        };
        if (
          !enrichedArgs.filePath &&
          !enrichedArgs.path &&
          !enrichedArgs.filename &&
          mentionedFiles.size === 1
        ) {
          enrichedArgs.filePath = [...mentionedFiles][0];
          enrichedArgs.path = [...mentionedFiles][0];
        }

        let preSnapshot: string | null = null;
        if (workspaceRootPath && rawTargetName) {
          preSnapshot = this.transcriptEngine.captureFileSnapshot(
            workspaceRootPath,
            rawTargetName,
          );
          this.transcriptEngine
            .appendEvent(workspaceRootPath, sessionId, 'file_snapshot_pre', {
              tool: funcName,
              filePath: rawTargetName,
              snapshotContent: preSnapshot,
              fileExisted: preSnapshot !== null,
              timestamp: new Date().toISOString(),
            })
            .catch(() => {});
        }

        result = await this.selfHealingService.executeWithIsolation(
          funcName,
          enrichedArgs,
          workspaceId,
        );

        if (workspaceRootPath && rawTargetName) {
          const postSnapshot = this.transcriptEngine.captureFileSnapshot(
            workspaceRootPath,
            rawTargetName,
          );
          this.transcriptEngine
            .appendEvent(workspaceRootPath, sessionId, 'tool_call_post', {
              tool: funcName,
              args,
              status: result.status,
              preview: result.preview,
              timestamp: new Date().toISOString(),
            })
            .catch(() => {});
          if (result.status === 'success') {
            this.transcriptEngine
              .appendEvent(workspaceRootPath, sessionId, 'file_snapshot_post', {
                tool: funcName,
                filePath: rawTargetName,
                snapshotContent: postSnapshot,
                timestamp: new Date().toISOString(),
              })
              .catch(() => {});
          }
        }
      } catch (e: any) {
        result = {
          status: 'error',
          data: {},
          preview: `Tool execution failed: ${e.message}`,
          metadata: {
            toolName: funcName,
            displayName: funcName,
            executionTime: 0,
          },
          error: { code: 'EXECUTION_FAILED', message: e.message },
        };
      }

      if (result.status === 'error') {
        this.logger.warn(
          `Tool "${funcName}" returned error: ${result.error?.message || result.preview}`,
        );
      }

      if (result.status === 'success' && result.metadata?.contentBase64) {
        const artifact = await this.artifactService.createFromAgent({
          workspaceId,
          type:
            result.metadata.format === 'xlsx' ||
            result.metadata.format === 'csv'
              ? 'spreadsheet'
              : 'document',
          name:
            result.metadata.filename || `workspace-output-${Date.now()}.file`,
          mimeType: result.metadata.mimeType || 'application/octet-stream',
          contentBase64: result.metadata.contentBase64,
          preview: result.preview,
          data: result.data,
          createdBy: `workspace-agent:${funcName}`,
          tags: [`workspace:${workspaceId}`, `tool:${funcName}`],
          lineage: [funcName],
        });
        createdArtifactIds.push(artifact.id);
      }

      onEvent({
        type: 'tool_done',
        data: {
          toolName: funcName,
          result,
          timestamp: new Date().toISOString(),
        },
      });

      if (result.status === 'success') {
        mutationsApplied++;
        const filename =
          args.filename || args.path || args.filePath || 'unknown';
        const fname = String(filename);
        if (fname && fname !== 'unknown') {
          touchedFiles.add(path.basename(fname).toLowerCase());
        }
        this.stateService.trackModifiedFile(workspaceId, filename);
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: ToolResultFormatter.formatForLlm(funcName, result),
      });
    }

    if (mutationsApplied > roundMutationsStart) {
      noProgressRounds = 0;
    } else {
      noProgressRounds++;
    }

    return {
      executedToolCount,
      mutationsApplied,
      noProgressRounds,
      concludeRun: false,
    };
  }
}
