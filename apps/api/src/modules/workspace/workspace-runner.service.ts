import { Injectable, Logger } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SearchService } from '../search/search.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';

export interface WorkspaceRunParams {
  workspaceId: string;
  userGoal: string;
  historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  approvedToolCalls?: Array<{ toolName: string; args: Record<string, any> }>;
}

export interface WorkspaceStreamEvent {
  type:
    | 'thinking'
    | 'plan_created'
    | 'tool_start'
    | 'approval_required'
    | 'tool_done'
    | 'text_delta'
    | 'done'
    | 'error';
  data: any;
}

@Injectable()
export class WorkspaceRunnerService {
  private readonly logger = new Logger(WorkspaceRunnerService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly storageService: StorageService,
    private readonly fileService: FileService,
    private readonly searchService: SearchService,
    private readonly artifactService: ArtifactService,
  ) {}

  async buildWorkspaceContext(workspaceId: string): Promise<string> {
    try {
      const files = await this.fileService.findByWorkspaceId(workspaceId);
      const fileList = files.length > 0
        ? files.map((f) => `- ${f.name} (Tipe: ${f.type || 'file'}, Ukuran: ${Math.round(f.size / 1024)} KB)`).join('\n')
        : 'Belum ada file di workspace ini.';

      return `=== WORKSPACE CONTEXT (ID: ${workspaceId}) ===\nDaftar Berkas Terdeteksi:\n${fileList}\n=== END WORKSPACE CONTEXT ===`;
    } catch {
      return '';
    }
  }

  async runWorkspaceAgentStream(
    params: WorkspaceRunParams,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ) {
    const { workspaceId, userGoal, historyMessages, approvedToolCalls = [] } = params;

    try {
      onEvent({ type: 'thinking', data: 'Memindai dokumen workspace dan menyusun rencana otonom...' });

      const workspaceContext = await this.buildWorkspaceContext(workspaceId);
      const systemPrompt = this.aiService.getSystemPrompt('workspace', undefined, workspaceContext);
      const tools = this.toolRegistryService.getToolDefinitions();

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ];

      // Generate autonomous reasoning plan via dedicated AI call
      const planningMessages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'Kamu membuat rencana kerja singkat (maksimal 5 poin, satu kalimat per poin, dalam Bahasa Indonesia) untuk mencapai goal user di sebuah workspace. Balas HANYA dengan poin-poin rencana, tanpa penjelasan tambahan, satu poin per baris, diawali angka.',
        },
        {
          role: 'user',
          content: `Goal: ${userGoal}\n\nKonteks workspace:\n${workspaceContext}`,
        },
      ];

      let steps: string[] = [];
      try {
        const planResponse = await this.aiService.chat(planningMessages, []);
        if (planResponse.content) {
          steps = planResponse.content
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      } catch (e) {
        this.logger.warn(`AI plan generation failed: ${e.message}`);
      }

      onEvent({
        type: 'plan_created',
        data: {
          goal: userGoal,
          steps: steps.length > 0 ? steps : ['Menyusun rencana berdasarkan goal Anda...'],
        },
      });

      let finalContent = '';
      const createdArtifactIds: string[] = [];
      const MAX_ROUNDS = 25;
      let reachedMaxRounds = true;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const aiResponse = await this.aiService.chat(messages, tools);

        if (aiResponse.toolCalls.length === 0) {
          finalContent = aiResponse.content;
          onEvent({ type: 'text_delta', data: finalContent });
          reachedMaxRounds = false;
          this.logger.log('Workspace agent finished goal execution within round limit.');
          break;
        }

        messages.push({
          role: 'assistant',
          content: aiResponse.content || null,
          tool_calls: aiResponse.toolCalls,
        });

        for (const toolCall of aiResponse.toolCalls) {
          const funcName = toolCall.function.name;
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            args = {};
          }

          // Safety Approval Gate Check for Mutating Actions
          const isMutatingTool = [
            'write_workspace_file',
            'update_workspace_file',
            'delete_workspace_file',
          ].includes(funcName);

          const isApproved = approvedToolCalls.some((tc) => {
            if (tc.toolName !== funcName) return false;
            if (!tc.args) return true;
            const tcFilename = tc.args.filename || tc.args.filePath || tc.args.path;
            const argsFilename = args.filename || args.filePath || args.path;
            if (tcFilename && argsFilename) {
              return tcFilename === argsFilename;
            }
            return JSON.stringify(tc.args) === JSON.stringify(args);
          });

          if (isMutatingTool && !isApproved) {
            this.logger.warn(
              `Approval Gate: Blocked execution of mutating tool "${funcName}" until user consent.`,
            );
            onEvent({
              type: 'approval_required',
              data: {
                toolName: funcName,
                args,
                description: `Agent ingin melakukan aksi "${funcName}" (${args.filename || args.filePath || ''}) pada workspace. Mohon izinkan untuk melanjutkan.`,
              },
            });
            // CRITICAL SECURITY FIX: Stop execution and wait for user approval
            return;
          }

          onEvent({
            type: 'tool_start',
            data: { toolName: funcName, args, timestamp: new Date().toISOString() },
          });

          let result: ToolResult;
          try {
            // Include workspaceId in tool args
            const enrichedArgs = { ...args, workspaceId };
            result = await this.toolRegistryService.executeTool(funcName, enrichedArgs);
          } catch (e) {
            result = {
              status: 'error',
              data: {},
              preview: `Eksekusi tool gagal: ${e.message}`,
              metadata: { toolName: funcName, displayName: funcName, executionTime: 0 },
              error: { code: 'EXECUTION_FAILED', message: e.message },
            };
          }

          if (result.status === 'success' && result.metadata?.contentBase64) {
            const artifact = await this.artifactService.createFromAgent({
              workspaceId,
              type: result.metadata.format === 'xlsx' || result.metadata.format === 'csv' ? 'spreadsheet' : 'document',
              name: result.metadata.filename || `workspace-output-${Date.now()}.file`,
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
            data: { toolName: funcName, result, timestamp: new Date().toISOString() },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      if (reachedMaxRounds) {
        this.logger.warn('Workspace agent reached max round limit without completion.');
        if (!finalContent) {
          finalContent =
            'Agent mencapai batas maksimal langkah kerja. Hasil sejauh ini mungkin belum lengkap — silakan lanjutkan permintaan jika perlu.';
        }
      } else if (!finalContent) {
        finalContent = 'Pekerjaan otonom di Workspace telah selesai.';
      }

      const artifactRecords = await Promise.all(
        createdArtifactIds.map((aid) => this.artifactService.findById(aid).catch(() => null)),
      );

      const artifacts = artifactRecords
        .filter(Boolean)
        .map((a) => {
          const meta = this.artifactService.parseMetadata(a!);
          return {
            id: a!.id,
            type: a!.type,
            filename: a!.name,
            mimeType: meta.mimeType || 'application/octet-stream',
            preview: a!.preview,
            status: 'draft',
            createdAt: a!.createdAt,
          };
        });

      onEvent({
        type: 'done',
        data: {
          content: finalContent,
          artifacts,
        },
      });

      return finalContent;
    } catch (error) {
      this.logger.error(`Workspace stream execution failed: ${error.message}`);
      onEvent({ type: 'error', data: { message: error.message } });
      throw error;
    }
  }
}
