import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
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
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Optional()
    @Inject(forwardRef(() => SubAgentRunnerService))
    private readonly subAgentRunner?: SubAgentRunnerService,
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

      this.logger.log(
        `[Cartographer] Starting background analysis for workspace "${workspace.name}"...`,
      );

      // 1. Scan top-level workspace files
      const fileSamples = await this.gatherWorkspaceSamples(rootPath);
      if (fileSamples.length === 0) {
        this.logger.log(
          `[Cartographer] Workspace "${workspace.name}" has no text/data files to analyze.`,
        );
        return;
      }

      // 2. Synthesize ARUNAKI.md via LLM or generic fallback
      const generatedRules = await this.synthesizeOperatingRules(
        workspace.name,
        fileSamples,
        existingRules,
      );

      // 3. Save to .arunaki/ARUNAKI.md
      await fsp.mkdir(path.join(rootPath, ARUNAKI_DIR), { recursive: true });
      await fsp.writeFile(targetRulesPath, generatedRules, 'utf8');

      // Update in-memory cache
      const stat = await fsp.stat(targetRulesPath);
      this.rulesCache.set(rootPath, {
        content: generatedRules,
        mtime: stat.mtimeMs,
      });

      // 4. (ARUNAKI.md is an internal workspace file - intentionally NOT shown in the Knowledge Graph)

      this.logger.log(
        `[Cartographer] Autonomous ARUNAKI.md created & synced successfully for "${workspace.name}".`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Cartographer] Background indexing failed: ${err.message}`,
      );
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
        content = `# ARUNAKI WORKSPACE OPERATING SYSTEM\n\n## 1. Domain & Business Profile\n- Workspace: ${workspace.name}\n`;
      }

      const timestamp = new Date().toISOString().split('T')[0];

      let oldSnippet = '';
      let newRule = learnedCorrection.trim();

      // Handle pre-formatted rules: extract the actual rule text
      const autoLearnedMatch = newRule.match(
        /^- \[Auto-Learned \d{4}-\d{2}-\d{2}\]: (.+)$/,
      );
      if (autoLearnedMatch) {
        newRule = autoLearnedMatch[1].trim();
      }

      if (newRule.startsWith('REPLACE:')) {
        const parts = newRule.replace('REPLACE:', '').split('->');
        if (parts.length === 2) {
          oldSnippet = parts[0].trim().replace(/^\[|\]$/g, '');
          newRule = parts[1].trim();
        }
      } else if (newRule.startsWith('ADD:')) {
        newRule = newRule.replace('ADD:', '').trim();
      }

      // Validate AFTER prefix stripping
      if (
        newRule.length < 5 ||
        /^(sorry|unable|error|try again)/i.test(newRule)
      ) {
        return;
      }

      const entry = `- [Auto-Learned ${timestamp}]: ${newRule}`;

      // Avoid exact duplicate
      if (content.includes(newRule)) {
        return;
      }

      const prefHeaderRegex =
        /## (\d+\. )?User Preferences & Learned Corrections/i;
      const prefMatch = content.match(prefHeaderRegex);

      if (prefMatch && prefMatch.index !== undefined) {
        const prefIndex = prefMatch.index;
        const beforePref = content.slice(0, prefIndex);
        let prefSection = content.slice(prefIndex);

        if (
          oldSnippet &&
          prefSection.toLowerCase().includes(oldSnippet.toLowerCase())
        ) {
          const prefLines = prefSection.split('\n');
          let replaced = false;
          prefSection = prefLines
            .map((line) => {
              if (
                !replaced &&
                line.toLowerCase().includes(oldSnippet.toLowerCase())
              ) {
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
              const matchCount = keywords.filter((k) =>
                l.toLowerCase().includes(k),
              ).length;
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
        // Find highest section number to avoid duplicates
        const sectionMatches = content.match(/^## (\d+)\./gm) || [];
        let maxSection = 0;
        for (const m of sectionMatches) {
          const num = parseInt(m.match(/## (\d+)\./)?.[1] || '0', 10);
          if (num > maxSection) maxSection = num;
        }
        const nextSection = Math.max(maxSection + 1, 8);
        content += `\n\n## ${nextSection}. User Preferences & Learned Corrections\n${entry}\n`;
      }

      await fsp.mkdir(path.join(workspace.rootPath, ARUNAKI_DIR), {
        recursive: true,
      });
      await fsp.writeFile(rulesPath, content, 'utf8');

      const stat = await fsp.stat(rulesPath);
      this.rulesCache.set(workspace.rootPath, { content, mtime: stat.mtimeMs });

      this.logger.log(
        `[Cartographer] Dynamic rule learned & patched: "${newRule.slice(0, 60)}..."`,
      );
    } catch (err: any) {
      this.logger.warn(`[Cartographer] Failed to patch rules: ${err.message}`);
    }
  }

  /**
   * Gathers lightweight samples (max 40 lines) from text/data files in workspace.
   */
  private async gatherWorkspaceSamples(
    rootPath: string,
  ): Promise<WorkspaceFileMetadata[]> {
    const samples: WorkspaceFileMetadata[] = [];
    try {
      const entries = await fsp.readdir(rootPath, { withFileTypes: true });
      const relevantExts = new Set([
        '.txt',
        '.csv',
        '.json',
        '.md',
        '.xlsx',
        '.xls',
        '.xlsm',
        '.tsv',
        '.docx',
        '.doc',
        '.pdf',
      ]);

      for (const entry of entries) {
        if (samples.length >= MAX_FILES_TO_SAMPLE) break;
        if (!entry.isFile() || entry.name.startsWith('.')) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!relevantExts.has(ext)) continue;

        const filePath = path.join(rootPath, entry.name);
        const stats = await fsp.stat(filePath);

        let sampleText = '';
        if (
          ext === '.txt' ||
          ext === '.csv' ||
          ext === '.tsv' ||
          ext === '.md' ||
          ext === '.json'
        ) {
          const raw = await fsp.readFile(filePath, 'utf8');
          const lines = raw.split('\n').slice(0, MAX_SAMPLE_LINES);
          sampleText = lines.join('\n');
        } else if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls') {
          try {
            const XLSX = await import('xlsx');
            const xlsxLib = (XLSX as any).default || XLSX;
            const workbook = xlsxLib.readFile(filePath, { sheetRows: 10 });
            const sheetSummaries: string[] = [];
            for (const sName of workbook.SheetNames.slice(0, 6)) {
              const sheet = workbook.Sheets[sName];
              if (sheet) {
                const csv = xlsxLib.utils.sheet_to_csv(sheet);
                const rows = csv
                  .split('\n')
                  .map((r: string) => r.trim())
                  .filter((r: string) => r.length > 0)
                  .slice(0, 6)
                  .join('\n');
                if (rows) {
                  sheetSummaries.push(`[Sheet: "${sName}"]\n${rows}`);
                }
              }
            }
            sampleText =
              sheetSummaries.join('\n\n') ||
              `[Spreadsheet: ${entry.name}, Sheets: ${workbook.SheetNames.join(', ')}]`;
          } catch (xlErr: any) {
            sampleText = `[Spreadsheet document: ${entry.name}, Size: ${(stats.size / 1024).toFixed(1)} KB]`;
          }
        } else if (ext === '.docx') {
          try {
            const mammothMod = await import('mammoth');
            const mammoth = (mammothMod as any).default || mammothMod;
            const result = await mammoth.extractRawText({ path: filePath });
            const lines = result.value
              .split('\n')
              .map((l: string) => l.trim())
              .filter((l: string) => l.length > 0)
              .slice(0, MAX_SAMPLE_LINES);
            sampleText = lines.join('\n');
          } catch (docErr: any) {
            sampleText = `[Word document: ${entry.name}, Size: ${(stats.size / 1024).toFixed(1)} KB]`;
          }
        } else {
          sampleText = `[Document: ${entry.name}, Size: ${(stats.size / 1024).toFixed(1)} KB]`;
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
      this.logger.warn(
        `[Cartographer] Sample gathering warning: ${err.message}`,
      );
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
          this.logger.debug(
            `Sub-agent cartography fallback to direct LLM: ${subErr.message}`,
          );
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
      this.logger.warn(
        `[Cartographer] LLM synthesis skipped (${err.message}). Using deterministic fallback.`,
      );
    }

    // Deterministic Generic Fallback (Completely domain-agnostic metadata index)
    return this.buildDeterministicRules(workspaceName, samples);
  }

  /**
   * Deterministic fallback generator when LLM is offline.
   * Completely domain-agnostic: generates a clean metadata & schema index with rich section and data samples.
   */
  private buildDeterministicRules(
    workspaceName: string,
    samples: WorkspaceFileMetadata[],
  ): string {
    const fileEntries = samples
      .map((s) => {
        const sizeKb = (s.size / 1024).toFixed(1);
        const ext = s.extension.toLowerCase();
        const content = s.sampleContent || '';

        // 1. Spreadsheet (.xlsx, .xlsm, .xls)
        if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls') {
          const sheetBlocks = content.split(/\[Sheet:\s*"([^"]+)"\]/);
          const sheets: { name: string; header: string; sample: string }[] = [];

          for (let i = 1; i < sheetBlocks.length; i += 2) {
            const sheetName = sheetBlocks[i];
            const sheetRows = (sheetBlocks[i + 1] || '')
              .split('\n')
              .map((r) => r.trim())
              .filter((r) => r.length > 0);
            const header = sheetRows[0] || '';
            const sample = sheetRows.slice(1, 3).join(' | ');
            sheets.push({ name: sheetName, header, sample });
          }

          let sheetDetails = '';
          if (sheets.length > 0) {
            sheetDetails = sheets
              .map(
                (sh) =>
                  `\n  - **Sheet \`${sh.name}\`**: Kolom: \`${sh.header.slice(0, 100)}\`${sh.sample ? `\n    - *Contoh Data*: \`${sh.sample.slice(0, 120)}\`` : ''}`,
              )
              .join('');
          }

          return `- \`${s.name}\` (${ext.toUpperCase().replace('.', '')}, ${sizeKb} KB)${sheetDetails || `\n  - *Info Spreadsheet*: ${content.slice(0, 150)}`}`;
        }

        // 2. JSON files
        if (ext === '.json') {
          try {
            const parsed = JSON.parse(content);
            const isArr = Array.isArray(parsed);
            const targetObj = isArr ? parsed[0] : parsed;
            const keys = targetObj && typeof targetObj === 'object' ? Object.keys(targetObj) : [];
            return `- \`${s.name}\` (JSON, ${sizeKb} KB)
  - **Struktur**: ${isArr ? `Array of Objects (${parsed.length} items)` : 'Root Object'}
  - **Field/Kunci**: ${keys.map((k) => `\`${k}\``).join(', ')}`;
          } catch {
            return `- \`${s.name}\` (JSON, ${sizeKb} KB)\n  - *Sample*: \`${content.slice(0, 100)}\``;
          }
        }

        // 3. Text, CSV, Markdown, Word (.txt, .csv, .tsv, .docx, .md)
        const lines = content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('[Binary'));

        const cleanLines = lines.filter(
          (l) => !/^[-=_*~]{3,}$/.test(l) && !/^#+\s*/.test(l),
        );

        const header = cleanLines[0]?.slice(0, 120) || s.name;

        // Extract key sections (e.g. "PEMASUKAN :", "NOTE BELUM BAYAR :", etc.)
        const sections = lines
          .filter(
            (l) =>
              /^[A-Z\s_-]{3,30}\s*:/i.test(l) &&
              !l.toLowerCase().startsWith('http'),
          )
          .map((l) => l.replace(/:\s*$/, '').trim())
          .slice(0, 8);

        // Extract real sample data lines (skip section titles and delimiters)
        const dataSamples = cleanLines
          .filter(
            (l) =>
              l !== cleanLines[0] &&
              !/^[A-Z\s_-]{3,30}\s*:/i.test(l) &&
              (l.includes('=') ||
                l.includes(':') ||
                l.includes('[') ||
                l.includes('✅') ||
                /\d/.test(l)),
          )
          .slice(0, 3);

        let sectionStr = '';
        if (sections.length > 0) {
          sectionStr = `\n  - **Bagian/Seksi Utama**: ${sections.map((sec) => `\`${sec}\``).join(', ')}`;
        }

        let sampleStr = '';
        if (dataSamples.length > 0) {
          sampleStr = `\n  - **Contoh Baris Data**: ${dataSamples.map((ds) => `\`${ds.slice(0, 80)}\``).join(', ')}`;
        }

        return `- \`${s.name}\` (${ext.toUpperCase().replace('.', '') || 'FILE'}, ${sizeKb} KB)
  - **Judul/Header**: \`${header}\`${sectionStr}${sampleStr}`;
      })
      .join('\n\n');

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

  /**
   * Automatically compresses ARUNAKI.md if it gets too large by merging and pruning redundant rules using the LLM.
   * This is the "Tukang Bersih Memori" for the workspace rulebook.
   */
  async compressWorkspaceRules(workspaceId: string): Promise<boolean> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { rootPath: true, name: true },
      });
      if (!workspace?.rootPath) return false;

      const rulesPath = this.getRulesFilePath(workspace.rootPath);
      let content = '';
      try {
        content = await fsp.readFile(rulesPath, 'utf8');
      } catch {
        return false;
      }

      // Only compress when noticeably bloated (> 3500 chars or > 60 lines)
      if (content.length < 3500 && content.split('\n').length < 60) {
        return false;
      }

      this.logger.log(
        `[Cartographer] 🧹 ARUNAKI.md for ${workspace.name} is bloated (${content.length} chars). Triggering Auto-Compression...`,
      );

      const prompt = `You are the Arunaki Cartographer Agent.
Your job is to compress and consolidate the ARUNAKI.md rulebook.
Over time, the "User Preferences & Learned Corrections" section may accumulate redundant, outdated, or duplicate rules.

CURRENT ARUNAKI.MD:
${content}

TASK:
Rewrite the ENTIRE ARUNAKI.md file.
- Keep the overall structure and sections intact.
- MERGE rules that talk about the same topic.
- REMOVE trivial or contradictory duplicates.
- Keep the language exactly as it is (do not translate).
Output ONLY the raw Markdown content for ARUNAKI.md without commentary or outer code fences.`;

      const response = await this.aiService.chat([
        {
          role: 'system',
          content:
            'You are an expert technical editor summarizing and merging system rulebooks.',
        },
        { role: 'user', content: prompt },
      ]);

      let compressedContent = response?.content?.trim() || '';

      if (compressedContent.startsWith('```markdown')) {
        compressedContent = compressedContent
          .replace(/^```markdown\n?/, '')
          .replace(/\n?```$/, '');
      } else if (compressedContent.startsWith('```')) {
        compressedContent = compressedContent
          .replace(/^```\n?/, '')
          .replace(/\n?```$/, '');
      }

      if (
        compressedContent &&
        compressedContent.length > 200 &&
        compressedContent.includes('# ARUNAKI')
      ) {
        // Guard: LLM rewrites must never drop learned user rules — restore any that went missing
        const learnedRules = content.match(/^- \[Auto-Learned .*$/gm) || [];
        const lower = compressedContent.toLowerCase();
        const missing = learnedRules.filter((rule) => {
          const text = rule
            .replace(/^- \[Auto-Learned \d{4}-\d{2}-\d{2}\]:\s*/i, '')
            .trim();
          return (
            text.length >= 5 &&
            !lower.includes(text.slice(0, Math.min(60, text.length)).toLowerCase())
          );
        });
        if (missing.length) {
          this.logger.log(
            `[Cartographer] 🛡️ Compression dropped ${missing.length} learned rule(s) — restoring.`,
          );
          const headerMatch = compressedContent.match(
            /^## \d*\.?\s*User Preferences & Learned Corrections.*$/im,
          );
          if (headerMatch && headerMatch.index !== undefined) {
            const at = headerMatch.index + headerMatch[0].length;
            compressedContent =
              compressedContent.slice(0, at) +
              '\n' +
              missing.join('\n') +
              compressedContent.slice(at);
          } else {
            compressedContent =
              compressedContent.trimEnd() +
              '\n\n## User Preferences & Learned Corrections\n' +
              missing.join('\n') +
              '\n';
          }
        }

        await fsp.writeFile(rulesPath, compressedContent, 'utf8');
        this.rulesCache.set(workspace.rootPath, {
          content: compressedContent,
          mtime: Date.now(),
        });
        this.logger.log(
          `[Cartographer] ✅ ARUNAKI.md compressed successfully (${content.length} -> ${compressedContent.length} chars)`,
        );
        return true;
      }

      return false;
    } catch (e: any) {
      this.logger.warn(`[Cartographer] Compression failed: ${e.message}`);
      return false;
    }
  }
}
