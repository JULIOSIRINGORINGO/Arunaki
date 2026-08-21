import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * Line-level document comparison engine.
 * Compares two text documents and produces a structured diff report.
 */
@Injectable()
export class DocCompareTool {
  private readonly logger = new Logger(DocCompareTool.name);

  /**
   * Compare two document texts and produce a structured diff.
   */
  compare(
    sourceText: string,
    targetText: string,
    sourceName: string = 'Document A',
    targetName: string = 'Document B',
  ): ToolResult {
    const startTime = Date.now();

    if (!sourceText && !targetText) {
      return {
        status: 'error',
        data: {},
        preview: 'Both documents are empty.',
        metadata: {
          toolName: 'doc_compare_versions',
          displayName: 'Compare Documents',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_DOCS', message: 'Both documents are empty' },
      };
    }

    const sourceLines = (sourceText || '').split('\n');
    const targetLines = (targetText || '').split('\n');

    // Compute LCS-based diff
    const diffResult = this.computeDiff(sourceLines, targetLines);

    // Calculate statistics
    const added = diffResult.filter((d) => d.type === 'added').length;
    const removed = diffResult.filter((d) => d.type === 'removed').length;
    const unchanged = diffResult.filter((d) => d.type === 'unchanged').length;
    const totalLines = Math.max(sourceLines.length, targetLines.length, 1);
    const similarityPercent = Math.round(
      (unchanged / totalLines) * 100,
    );

    // Generate Markdown diff table
    const markdownReport = this.generateMarkdownReport(
      diffResult,
      sourceName,
      targetName,
      { added, removed, unchanged, similarityPercent },
    );

    return {
      status: 'success',
      data: {
        sourceName,
        targetName,
        sourceLineCount: sourceLines.length,
        targetLineCount: targetLines.length,
        added,
        removed,
        unchanged,
        similarityPercent,
        diffEntries: diffResult.slice(0, 200), // cap for context window safety
      },
      preview: markdownReport,
      metadata: {
        toolName: 'doc_compare_versions',
        displayName: 'Compare Documents',
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Compute a line-level diff using the LCS (Longest Common Subsequence) algorithm.
   */
  private computeDiff(
    sourceLines: string[],
    targetLines: string[],
  ): Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum?: number }> {
    const m = sourceLines.length;
    const n = targetLines.length;

    // Build LCS length table
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (sourceLines[i - 1] === targetLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to produce diff entries
    const result: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum?: number }> = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && sourceLines[i - 1] === targetLines[j - 1]) {
        result.unshift({ type: 'unchanged', line: sourceLines[i - 1], lineNum: i });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: 'added', line: targetLines[j - 1], lineNum: j });
        j--;
      } else {
        result.unshift({ type: 'removed', line: sourceLines[i - 1], lineNum: i });
        i--;
      }
    }

    return result;
  }

  /**
   * Generate a Markdown-formatted comparison report.
   */
  private generateMarkdownReport(
    diffEntries: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string }>,
    sourceName: string,
    targetName: string,
    stats: { added: number; removed: number; unchanged: number; similarityPercent: number },
  ): string {
    const lines: string[] = [];
    lines.push(`### Document Comparison Report`);
    lines.push(``);
    lines.push(`**Source:** ${sourceName}`);
    lines.push(`**Target:** ${targetName}`);
    lines.push(`**Similarity:** ${stats.similarityPercent}%`);
    lines.push(`**Changes:** +${stats.added} added, -${stats.removed} removed, ${stats.unchanged} unchanged`);
    lines.push(``);

    // Show only the changed lines (with surrounding context)
    const changedEntries = diffEntries.filter((d) => d.type !== 'unchanged');

    if (changedEntries.length === 0) {
      lines.push(`✅ Documents are identical — no differences found.`);
    } else {
      lines.push(`| Status | Line |`);
      lines.push(`| --- | --- |`);

      let shownCount = 0;
      const maxShow = 50;
      for (const entry of diffEntries) {
        if (shownCount >= maxShow) {
          lines.push(`| ... | *(${diffEntries.length - maxShow} more lines not shown)* |`);
          break;
        }
        const safeText = entry.line.replace(/\|/g, '\\|').substring(0, 120);
        if (entry.type === 'added') {
          lines.push(`| ➕ Added | ${safeText} |`);
          shownCount++;
        } else if (entry.type === 'removed') {
          lines.push(`| ➖ Removed | ${safeText} |`);
          shownCount++;
        }
        // Skip unchanged in the table for brevity
      }
    }

    return lines.join('\n');
  }
}
