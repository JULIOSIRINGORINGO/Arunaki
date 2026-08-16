import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { AiService } from '../../ai/ai.service.js';
import { SubAgentRunnerService } from '../../chat/sub-agent-runner.service.js';

const ARUNAKI_RULES_FILENAME = 'ARUNAKI.md';
const ARUNAKI_DIR = '.arunaki';
const MAX_SAMPLE_LINES = 40;
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
    private readonly prisma: PrismaService,
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
      // If .arunaki/ARUNAKI.md does not exist yet, check root ARUNAKI.md fallback
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
        // Doesn't exist yet
      }

      this.logger.log(`[Cartographer] Starting background analysis for workspace "${workspace.name}"...`);

      // 1. Scan directory non-recursively (top-level files)
      const fileSamples = await this.gatherWorkspaceSamples(rootPath);
      if (fileSamples.length === 0) {
        this.logger.log(`[Cartographer] Workspace "${workspace.name}" has no text/data files to analyze.`);
        return;
      }

      // 2. Synthesize ARUNAKI.md via lightweight LLM call or smart heuristic generator
      const generatedRules = await this.synthesizeOperatingRules(workspace.name, fileSamples, existingRules);

      // 3. Save to .arunaki/ARUNAKI.md
      await fsp.mkdir(path.join(rootPath, ARUNAKI_DIR), { recursive: true });
      await fsp.writeFile(targetRulesPath, generatedRules, 'utf8');

      // Update cache
      const stat = await fsp.stat(targetRulesPath);
      this.rulesCache.set(rootPath, { content: generatedRules, mtime: stat.mtimeMs });

      // 4. Sync into Knowledge Graph DB so it appears cleanly in the UI Knowledge Page
      await this.syncToKnowledgeDb(workspaceId, workspace.name, generatedRules);

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
        content = `# ARUNAKI WORKSPACE OPERATING SYSTEM\n\n## 1. Domain & Business Profile\n- Workspace: ${workspace.name}\n\n## 4. User Preferences & Learned Corrections\n`;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const entry = `- [Auto-Learned ${timestamp}]: ${learnedCorrection.trim()}`;

      if (content.includes(learnedCorrection.trim())) {
        return; // Avoid duplicates
      }

      if (content.includes('## 4. User Preferences & Learned Corrections')) {
        content = content.replace(
          '## 4. User Preferences & Learned Corrections',
          `## 4. User Preferences & Learned Corrections\n${entry}`,
        );
      } else {
        content += `\n\n## 4. User Preferences & Learned Corrections\n${entry}\n`;
      }

      await fsp.mkdir(path.join(workspace.rootPath, ARUNAKI_DIR), { recursive: true });
      await fsp.writeFile(rulesPath, content, 'utf8');

      const stat = await fsp.stat(rulesPath);
      this.rulesCache.set(workspace.rootPath, { content, mtime: stat.mtimeMs });

      // Sync to Knowledge Graph DB
      await this.syncToKnowledgeDb(workspaceId, workspace.name, content);
      this.logger.log(`[Cartographer] Dynamic rule learned & patched: "${learnedCorrection.slice(0, 60)}..."`);
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
            `### File: \`${s.name}\` (${(s.size / 1024).toFixed(1)} KB)\n\`\`\`\n${s.sampleContent.slice(0, 800)}\n\`\`\``,
        )
        .join('\n\n');

      const prompt = `You are the Cartographer Engine for Arunaki, an autonomous document assistant.
Analyze these files in workspace "${workspaceName}" and construct a living system prompt rulebook named "ARUNAKI.md".

FILES SAMPLED FROM WORKSPACE:
${sampleSummary}

${existingRules ? `EXISTING RULES TO PRESERVE:\n${existingRules.slice(0, 1000)}\n` : ''}

Instructions:
Carefully deduce the nature of the workspace based strictly on the provided file samples (e.g. accounting, legal, retail, logistics, manufacturing, education, medical, personal records, software, etc.).

Generate a concise, crisp, and high-precision markdown rulebook formatted strictly with these 4 sections:
# ARUNAKI WORKSPACE OPERATING SYSTEM

## 1. Domain & Workspace Profile
- Identify the domain/business type, primary workflow, currency or numerical conventions, and recurring terminology or status codes observed in the files.

## 2. File Directory & Data Relationships
- Table or list of files explaining each file's specific role, primary/master documents vs secondary/input documents, and how data moves or references between them.

## 3. Strict Syntax & Layout Invariants
- Document formatting rules observed in the files (headers, tables, delimiters, status indicators, formulas, or summary blocks that must be preserved without corruption).
- Operating rule: Always prefer surgical \`edit\` tool for existing documents; do not wipe out historical records or template structures.

## 4. User Preferences & Learned Corrections
- Include any existing user preferences or provide placeholders for dynamic self-corrections learned from future conversations.

Output ONLY the raw markdown content, with no conversational preamble or outer code fences.`;

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

      // 2. Direct LLM fallback if subAgentRunner is unavailable
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
      this.logger.warn(`[Cartographer] LLM synthesis skipped (${err.message}). Using deterministic heuristic fallback.`);
    }

    // Deterministic Heuristic Fallback
    return this.buildDeterministicRules(workspaceName, samples);
  }

  /**
   * Deterministic fallback generator when LLM is offline or in cold start.
   * Dynamically constructs a generic, domain-agnostic operational rulebook.
   */
  private buildDeterministicRules(workspaceName: string, samples: WorkspaceFileMetadata[]): string {
    const fileEntries = samples.map((s) => {
      const sizeKb = (s.size / 1024).toFixed(1);
      return `- \`${s.name}\` (${s.extension.toUpperCase().replace('.', '') || 'FILE'}, ${sizeKb} KB)`;
    }).join('\n');

    const fileTypes = Array.from(new Set(samples.map((s) => s.extension.toLowerCase().replace('.', ''))));

    return `# ARUNAKI WORKSPACE OPERATING SYSTEM

## 1. Domain & Workspace Profile
- **Workspace Name**: ${workspaceName}
- **Detected File Formats**: ${fileTypes.join(', ') || 'text documents'}
- **Primary Mode**: Autonomous Document & Data Management

## 2. File Directory & Data Map
${fileEntries || '- (No files indexed yet)'}

## 3. Strict Operating Invariants
- **Surgical Edits**: Always prefer surgical tool \`edit\` to modify existing files. Never overwrite whole files with \`write\` unless explicitly creating a new document.
- **Structure Preservation**: Respect and preserve existing document formatting, headers, tables, formulas, and balance summaries.
- **Data Integrity**: Never remove historical records or existing sections unless explicitly instructed by the user.

## 4. User Preferences & Learned Corrections
- [Initial System Baseline]: Maintain exact file schema and adapt to user conventions dynamically.
`;
  }

  /**
   * Syncs the generated rules into Prisma knowledge table so it appears in the Knowledge Graph UI.
   */
  private async syncToKnowledgeDb(workspaceId: string, workspaceName: string, markdownContent: string): Promise<void> {
    try {
      const title = `Rules & Workspace Map (${workspaceName})`;
      const existing = await this.prisma.knowledge.findFirst({
        where: {
          title,
        },
      });

      if (existing) {
        await this.prisma.knowledge.update({
          where: { id: existing.id },
          data: {
            content: markdownContent,
            type: 'rules',
            nodeColor: '#10B981',
            icon: 'book-open',
          },
        });
      } else {
        await this.prisma.knowledge.create({
          data: {
            title,
            content: markdownContent,
            type: 'rules',
            nodeColor: '#10B981',
            icon: 'book-open',
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`[Cartographer] Sync to knowledge DB non-fatal error: ${err.message}`);
    }
  }
}
