import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { AiService } from '../../ai/ai.service.js';
import { SubAgentRunnerService } from '../../chat/sub-agent-runner.service.js';

const ARUNAKI_RULES_FILENAME = 'ARUNAKI.md';
const ARUNAKI_DIR = '.arunaki';
const MAX_SAMPLE_LINES = 200;
const MAX_FILES_TO_SAMPLE = 12;

export interface WorkspaceFileMetadata {
  name: string;
  relativePath: string;
  extension: string;
  size: number;
  sampleContent: string;
}

@Injectable()
export class WorkspaceCartographerService {
  private readonly logger = new Logger(WorkspaceCartographerService.name);
  private rulesCache = new Map<string, { content: string; mtime: number }>();

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Optional() @Inject(forwardRef(() => SubAgentRunnerService)) private readonly subAgentRunner?: SubAgentRunnerService,
  ) {}

  /**
   * Returns the path to the workspace's ARUNAKI.md rules file.
   */
  getRulesFilePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, ARUNAKI_DIR, ARUNAKI_RULES_FILENAME);
  }

  /**
   * Reads the current ARUNAKI.md system prompt rules for a workspace.
   * Utilizes an in-memory cache to ensure 0ms latency during chat streaming.
   */
  async getWorkspaceRules(workspaceRoot: string): Promise<string> {
    const rulesPath = this.getRulesFilePath(workspaceRoot);
    try {
      const stats = await fsp.stat(rulesPath);
      const cached = this.rulesCache.get(workspaceRoot);
      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.content;
      }

      const content = await fsp.readFile(rulesPath, 'utf8');
      this.rulesCache.set(workspaceRoot, { content, mtime: stats.mtimeMs });
      return content;
    } catch {
      // Fallback to root ARUNAKI.md if .arunaki/ARUNAKI.md does not exist yet
      const rootPath = path.join(workspaceRoot, ARUNAKI_RULES_FILENAME);
      try {
        const content = await fsp.readFile(rootPath, 'utf8');
        return content;
      } catch {
        return '';
      }
    }
  }

  /**
   * Asynchronously scans workspace files, extracts structured samples,
   * synthesizes domain relationships, and writes the ARUNAKI.md rules file.
   * Non-blocking and designed to run in background.
   */
  async analyzeAndBootstrap(workspaceId: string): Promise<void> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, rootPath: true },
      });

      if (!workspace || !workspace.rootPath) {
        return;
      }

      const rootPath = workspace.rootPath;
      const targetRulesPath = this.getRulesFilePath(rootPath);

      // Check if rules file already exists to preserve existing custom rules
      let existingRules = '';
      try {
        existingRules = await fsp.readFile(targetRulesPath, 'utf8');
      } catch {
        // Does not exist yet
      }

      this.logger.log(`[Cartographer] Starting background analysis for workspace "${workspace.name}"...`);

      // 1. Scan top-level workspace files
      const fileSamples = await this.gatherWorkspaceSamples(rootPath);
      if (fileSamples.length === 0) {
        this.logger.log(`[Cartographer] Workspace "${workspace.name}" has no text/data files to analyze.`);
        return;
      }

      // 2. Synthesize ARUNAKI.md via LLM or generic fallback
      const generatedRules = await this.synthesizeOperatingRules(workspace.name, fileSamples, existingRules);

      // 3. Save to .arunaki/ARUNAKI.md
      await fsp.mkdir(path.join(rootPath, ARUNAKI_DIR), { recursive: true });
      await fsp.writeFile(targetRulesPath, generatedRules, 'utf8');

      // Update in-memory cache
      const stat = await fsp.stat(targetRulesPath);
      this.rulesCache.set(rootPath, { content: generatedRules, mtime: stat.mtimeMs });

      // 4. (ARUNAKI.md is an internal workspace file - intentionally NOT shown in the Knowledge Graph)

      this.logger.log(`[Cartographer] Autonomous ARUNAKI.md created & synced successfully for "${workspace.name}".`);
    } catch (err: any) {
      this.logger.error(`[Cartographer] Background indexing failed: ${err.message}`);
    }
  }

  /**
   * Updates or appends user corrections/preferences into ARUNAKI.md dynamically.
   */
  async patchWorkspaceRules(
    workspaceId: string,
    learnedCorrection: string,
  ): Promise<void> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { rootPath: true, name: true },
      });
      if (!workspace?.rootPath || !learnedCorrection.trim()) return;

      const rulesPath = this.getRulesFilePath(workspace.rootPath);
      let content = '';
      try {
        content = await fsp.readFile(rulesPath, 'utf8');
      } catch {
        content = `# ARUNAKI WORKSPACE OPERATING SYSTEM\n\n## 1. Domain & Business Profile\n- Workspace: ${workspace.name}\n\n## 7. User Preferences & Learned Corrections\n`;
      }

      const timestamp = new Date().toISOString().split('T')[0];

      let oldSnippet = '';
      let newRule = learnedCorrection.trim();

      if (newRule.startsWith('REPLACE:')) {
        const parts = newRule.replace('REPLACE:', '').split('->');
        if (parts.length === 2) {
          oldSnippet = parts[0].trim().replace(/^\[|\]$/g, '');
          newRule = parts[1].trim();
        }
      } else if (newRule.startsWith('ADD:')) {
        newRule = newRule.replace('ADD:', '').trim();
      }

      const entry = `- [Auto-Learned ${timestamp}]: ${newRule}`;

      // Avoid exact duplicate
      if (content.includes(newRule)) {
        return;
      }

      const prefHeaderRegex = /## (\d+\. )?User Preferences & Learned Corrections/i;
      const prefMatch = content.match(prefHeaderRegex);

      if (prefMatch && prefMatch.index !== undefined) {
        const prefIndex = prefMatch.index;
        const beforePref = content.slice(0, prefIndex);
        let prefSection = content.slice(prefIndex);

        if (oldSnippet && prefSection.toLowerCase().includes(oldSnippet.toLowerCase())) {
          const prefLines = prefSection.split('\n');
          let replaced = false;
          prefSection = prefLines
            .map((line) => {
              if (!replaced && line.toLowerCase().includes(oldSnippet.toLowerCase())) {
                replaced = true;
                return entry;
              }
              return line;
            })
            .join('\n');
        } else {
          const lines = prefSection.split('\n');
          const headerLine = lines[0];
          const restLines = lines.slice(1);

          // Check if existing learned bullets discuss the same subject and supersede them
          const keywords = newRule
            .toLowerCase()
            .split(/[\s,()"'`\-_.:;]+/)
            .filter((w) => w.length >= 3)
            .map((w) => w.slice(0, 4));

          let replacedOld = false;
          const filteredRest: string[] = [];

          for (const l of restLines) {
            if (l.trim().startsWith('- [')) {
              const matchCount = keywords.filter((k) => l.toLowerCase().includes(k)).length;
              if (matchCount >= 2) {
                if (!replacedOld) {
                  filteredRest.push(entry);
                  replacedOld = true;
                }
                continue; // Drop conflicting older line
              }
            }
            if (l.trim().length > 0) {
              filteredRest.push(l);
            }
          }

          if (!replacedOld) {
            filteredRest.unshift(entry);
          }

          prefSection = [headerLine, ...filteredRest].join('\n');
        }

        content = beforePref + prefSection;
      } else {
        content += `\n\n## 7. User Preferences & Learned Corrections\n${entry}\n`;
      }

      await fsp.mkdir(path.join(workspace.rootPath, ARUNAKI_DIR), { recursive: true });
      await fsp.writeFile(rulesPath, content, 'utf8');

      const stat = await fsp.stat(rulesPath);
      this.rulesCache.set(workspace.rootPath, { content, mtime: stat.mtimeMs });

      this.logger.log(`[Cartographer] Dynamic rule learned & patched: "${newRule.slice(0, 60)}..."`);
    } catch (err: any) {
      this.logger.warn(`[Cartographer] Failed to patch rules: ${err.message}`);
    }
  }

  /**
   * Gathers lightweight samples (max 40 lines) from text/data files in workspace.
   */
  private async gatherWorkspaceSamples(rootPath: string): Promise<WorkspaceFileMetadata[]> {
    const samples: WorkspaceFileMetadata[] = [];
    try {
      const entries = await fsp.readdir(rootPath, { withFileTypes: true });
      const relevantExts = new Set(['.txt', '.csv', '.json', '.md', '.xlsx', '.xls', '.tsv']);

      for (const entry of entries) {
        if (samples.length >= MAX_FILES_TO_SAMPLE) break;
        if (!entry.isFile() || entry.name.startsWith('.')) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!relevantExts.has(ext)) continue;

        const filePath = path.join(rootPath, entry.name);
        const stats = await fsp.stat(filePath);

        let sampleText = '';
        if (ext === '.txt' || ext === '.csv' || ext === '.tsv' || ext === '.md' || ext === '.json') {
          const raw = await fsp.readFile(filePath, 'utf8');
          const lines = raw.split('\n').slice(0, MAX_SAMPLE_LINES);
          sampleText = lines.join('\n');
        } else {
          sampleText = `[Binary/Spreadsheet document: ${entry.name}, Size: ${(stats.size / 1024).toFixed(1)} KB]`;
        }

        samples.push({
          name: entry.name,
          relativePath: entry.name,
          extension: ext,
          size: stats.size,
          sampleContent: sampleText,
        });
      }
    } catch (err: any) {
      this.logger.warn(`[Cartographer] Sample gathering warning: ${err.message}`);
    }
    return samples;
  }

  /**
   * Synthesizes high-precision system prompt markdown rules from file samples.
   */
  private async synthesizeOperatingRules(
    workspaceName: string,
    samples: WorkspaceFileMetadata[],
    existingRules: string,
  ): Promise<string> {
    try {
      const sampleSummary = samples
        .map(
          (s) =>
            `### File: \`${s.name}\` (${(s.size / 1024).toFixed(1)} KB)\n\`\`\`\n${s.sampleContent.slice(0, 4000)}\n\`\`\``,
        )
        .join('\n\n');

      const prompt = `Analyze the sampled files from workspace "${workspaceName}":

${sampleSummary}

${existingRules ? `PREVIOUS RULES (IF ANY):\n${existingRules.slice(0, 1000)}\n` : ''}

TASK:
You are the Cartographer for Arunaki. Inspect all documents in this workspace, understand their schemas, workflows, and operational rules, and synthesize a comprehensive operational rulebook named "ARUNAKI.md".

Guidelines:
1. Deduce the exact domain, purpose, structure, and cross-file relationships directly from the file samples.
2. Define clear operational rules for document automation (when to read, when to create new files, when to edit surgically).
3. Ensure the rules enable the AI agent to handle raw user inputs autonomously with Minimal Typing and Maximum Automation.

Output ONLY the raw Markdown content for ARUNAKI.md without commentary or outer code fences.`;

      // 1. If SubAgentRunner is available, execute via isolated Sub-Agent sandbox
      if (this.subAgentRunner) {
        try {
          const subResult = await this.subAgentRunner.spawnSubAgent({
            taskId: `cartographer_${Date.now()}`,
            taskName: `Workspace Cartographer (${workspaceName})`,
            taskDescription: prompt,
            allowedTools: ['read', 'list', 'search_workspace'],
            maxRounds: 3,
          });
          if (subResult.status === 'success' && subResult.content?.trim()) {
            return subResult.content.trim();
          }
        } catch (subErr: any) {
          this.logger.debug(`Sub-agent cartography fallback to direct LLM: ${subErr.message}`);
        }
      }

      // 2. Direct LLM fallback
      const response = await this.aiService.chat([
        {
          role: 'system',
          content:
            'You are an expert system prompt engineer creating precise operational rulebooks for document automation agents.',
        },
        { role: 'user', content: prompt },
      ]);

      if (response?.content?.trim()) {
        return response.content.trim();
      }
    } catch (err: any) {
      this.logger.warn(`[Cartographer] LLM synthesis skipped (${err.message}). Using deterministic fallback.`);
    }

    // Deterministic Generic Fallback (Completely domain-agnostic metadata index)
    return this.buildDeterministicRules(workspaceName, samples);
  }

  /**
   * Deterministic fallback generator when LLM is offline.
   * Completely domain-agnostic: generates a clean metadata & schema index without hardcoded assumptions.
   */
  private buildDeterministicRules(workspaceName: string, samples: WorkspaceFileMetadata[]): string {
    const fileEntries = samples.map((s) => {
      const sizeKb = (s.size / 1024).toFixed(1);
      const lines = (s.sampleContent || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('[Binary'));

      let header = '';
      let sampleLine = '';

      if (lines.length > 0) {
        header = lines[0].replace(/[";]/g, '').slice(0, 120);
        if (lines.length > 1) {
          sampleLine = lines[1].replace(/[";]/g, '').slice(0, 120);
        }
      }

      return `- \`${s.name}\` (${s.extension.toUpperCase().replace('.', '') || 'FILE'}, ${sizeKb} KB)
  ${header ? `- **Header/Structure**: \`${header}\`` : ''}
  ${sampleLine ? `- **Sample Line**: \`${sampleLine}\`` : ''}`;
    }).join('\n');

    return `# ARUNAKI WORKSPACE OPERATING SYSTEM — ${workspaceName.toUpperCase()}

## 1. Workspace Profile & Indexed Files
${fileEntries || '- (No files indexed yet)'}

## 2. Tool Usage Directives
- **Read**: Use \`read\` to search and inspect document data.
- **Write**: Use \`write\` ONLY when creating brand-new documents.
- **Edit**: Always use surgical \`edit\` to insert or update existing records without wiping historical data.

## 3. Minimal Typing, Maximum Automation
- **Implicit Ingestion**: When raw text or unformatted data snippets are provided without an introductory command, immediately match them to the relevant document structure and apply the updates. NEVER ask "What should I do with this?".
- **Single-Turn Ripple Updates**: Autonomously execute all cascading mutations, calculations, and status tracking across affected documents in a single pass.

## 4. User Preferences & Learned Corrections
- [Initial System Baseline]: Active operating rules synchronized for ${workspaceName}.
`;
  }
}
