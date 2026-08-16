import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { AiService } from '../../ai/ai.service.js';

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
Analyze these files in workspace "${workspaceName}" and construct a living system prompt file named "ARUNAKI.md".

FILES SAMPLED:
${sampleSummary}

${existingRules ? `EXISTING RULES TO PRESERVE:\n${existingRules.slice(0, 1000)}\n` : ''}

Generate a concise, crisp, and high-precision markdown rulebook formatted strictly with these sections:
# ARUNAKI WORKSPACE OPERATING SYSTEM

## 1. Domain & Business Profile
(Identify business type, currency shorthand e.g. 1.876RB = 1.876.000, bank names, customer prefixes e.g. CK, BG)

## 2. File Directory & Data Relationships
(Explain what each file is for, which file is the primary ledger, and how data moves between them)

## 3. Strict Syntax & Layout Invariants
(List exact line formats, checklist markers e.g. ✅, and sections that must NEVER be deleted like deposit balances)

## 4. User Preferences & Learned Corrections
(Include any existing learned preferences or leave template for dynamic learnings)

Output ONLY the markdown content, with no introductory banter or outer code fences.`;

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
   */
  private buildDeterministicRules(workspaceName: string, samples: WorkspaceFileMetadata[]): string {
    const fileList = samples.map((s) => `- \`${s.name}\`: Document data file (${s.extension})`).join('\n');

    return `# ARUNAKI WORKSPACE OPERATING SYSTEM

## 1. Domain & Business Profile
- **Workspace**: ${workspaceName}
- **Currency Convention**: Shorthand notation (e.g., "1.876RB" = Rp 1.876.000, "75RB" = Rp 75.000, "1.182RB" = Rp 1.182.000).
- **Payment Methods**: BCA, BNI, BRI, CASH.

## 2. File Directory & Data Relationships
${fileList}

## 3. Strict Syntax & Layout Invariants
- Always use surgical tool \`edit\` to modify files. Never overwrite whole files with \`write\`.
- Keep established record formats with customer tags (e.g. \`CK NAME = AMOUNT(BANK) [ ITEM ]✅\`).
- Never delete deposit balances, expense summary lines, or historical records unless explicitly instructed.

## 4. User Preferences & Learned Corrections
- [Initial System Baseline]: Maintain exact line format and append new transactions under their respective categories.
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
