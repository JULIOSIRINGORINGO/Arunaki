import { Injectable, Logger } from '@nestjs/common';

export interface ReconciliationItem {
  id?: string;
  name: string;
  data: Record<string, any>[];
}

export interface DiscrepancyResult {
  key: string;
  sourceValues: Record<string, any>;
  hasMismatch: boolean;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_SOURCE' | 'MISSING_IN_TARGET';
  details: string[];
}

export interface ReconciliationReport {
  summary: {
    totalItemsChecked: number;
    matchCount: number;
    mismatchCount: number;
    missingCount: number;
    matchPercentage: number;
  };
  discrepancies: DiscrepancyResult[];
  formattedTableMarkdown: string;
}

export interface CrossReferenceMatch {
  documentName: string;
  matchedText: string;
  contextSnippet: string;
  occurrenceCount: number;
}

@Injectable()
export class DocumentReconciliationService {
  private readonly logger = new Logger(DocumentReconciliationService.name);

  /**
   * Reconcile structured rows between primary (source) and secondary (target) document datasets.
   */
  reconcileDocuments(
    sourceName: string,
    sourceRows: Record<string, any>[],
    targetName: string,
    targetRows: Record<string, any>[],
    matchKey: string = 'id',
  ): ReconciliationReport {
    this.logger.log(
      `Reconciling ${sourceName} (${sourceRows.length} rows) vs ${targetName} (${targetRows.length} rows) on key "${matchKey}"`,
    );

    const sourceMap = new Map<string, Record<string, any>>();
    const targetMap = new Map<string, Record<string, any>>();

    // Helper to find case-insensitive key value
    const extractKey = (row: Record<string, any>): string => {
      if (!row) return '';
      if (row[matchKey] !== undefined)
        return String(row[matchKey]).trim().toLowerCase();
      // Case-insensitive lookup
      const foundKey = Object.keys(row).find(
        (k) => k.toLowerCase() === matchKey.toLowerCase(),
      );
      if (foundKey && row[foundKey] !== undefined) {
        return String(row[foundKey]).trim().toLowerCase();
      }
      // Fallback: search for invoice, no, id, code
      const altKey = Object.keys(row).find((k) =>
        /id|no|kode|code|invoice|ref/i.test(k),
      );
      return altKey && row[altKey] !== undefined
        ? String(row[altKey]).trim().toLowerCase()
        : '';
    };

    const safeSourceRows = Array.isArray(sourceRows) ? sourceRows : [];
    const safeTargetRows = Array.isArray(targetRows) ? targetRows : [];

    safeSourceRows.forEach((r, idx) => {
      const keyVal = extractKey(r) || `row_${idx + 1}`;
      sourceMap.set(keyVal, r);
    });

    safeTargetRows.forEach((r, idx) => {
      const keyVal = extractKey(r) || `row_${idx + 1}`;
      targetMap.set(keyVal, r);
    });

    const allKeys = new Set([...sourceMap.keys(), ...targetMap.keys()]);
    const discrepancies: DiscrepancyResult[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;

    for (const key of allKeys) {
      const srcVal = sourceMap.get(key);
      const tgtVal = targetMap.get(key);

      if (srcVal && !tgtVal) {
        missingCount++;
        discrepancies.push({
          key,
          sourceValues: srcVal,
          hasMismatch: true,
          status: 'MISSING_IN_TARGET',
          details: [
            `Record "${key}" exists in ${sourceName} but is missing in ${targetName}`,
          ],
        });
      } else if (!srcVal && tgtVal) {
        missingCount++;
        discrepancies.push({
          key,
          sourceValues: tgtVal,
          hasMismatch: true,
          status: 'MISSING_IN_SOURCE',
          details: [
            `Record "${key}" exists in ${targetName} but is missing in ${sourceName}`,
          ],
        });
      } else if (srcVal && tgtVal) {
        const diffs: string[] = [];
        // Compare common properties
        const allProps = new Set([
          ...Object.keys(srcVal),
          ...Object.keys(tgtVal),
        ]);
        for (const prop of allProps) {
          if (prop.toLowerCase() === matchKey.toLowerCase()) continue;
          const v1 = srcVal[prop];
          const v2 = tgtVal[prop];

          // If numeric, compare float values
          if (
            !isNaN(Number(v1)) &&
            !isNaN(Number(v2)) &&
            v1 !== '' &&
            v2 !== ''
          ) {
            if (Math.abs(Number(v1) - Number(v2)) > 0.001) {
              diffs.push(
                `Property "${prop}": ${sourceName}=${v1} vs ${targetName}=${v2}`,
              );
            }
          } else if (v1 !== undefined && v2 !== undefined) {
            if (String(v1).trim() !== String(v2).trim()) {
              diffs.push(`Property "${prop}": "${v1}" vs "${v2}"`);
            }
          }
        }

        if (diffs.length > 0) {
          mismatchCount++;
          discrepancies.push({
            key,
            sourceValues: srcVal,
            hasMismatch: true,
            status: 'MISMATCH',
            details: diffs,
          });
        } else {
          matchCount++;
          discrepancies.push({
            key,
            sourceValues: srcVal,
            hasMismatch: false,
            status: 'MATCH',
            details: ['Records match perfectly'],
          });
        }
      }
    }

    const total = allKeys.size;
    const matchPercentage =
      total > 0 ? Math.round((matchCount / total) * 100) : 100;

    // Generate clean formatted Markdown Table
    let tableMd = `### Document Reconciliation Report\n\n`;
    tableMd += `**Source Document:** ${sourceName} (${safeSourceRows.length} records)\n`;
    tableMd += `**Target Document:** ${targetName} (${safeTargetRows.length} records)\n`;
    tableMd += `**Match Key:** \`${matchKey}\` | **Reconciliation Accuracy:** ${matchPercentage}%\n\n`;
    tableMd += `| Key | Status | Details |\n`;
    tableMd += `| --- | --- | --- |\n`;

    discrepancies.forEach((d) => {
      const badge =
        d.status === 'MATCH'
          ? '✅ MATCH'
          : d.status === 'MISMATCH'
            ? '⚠️ MISMATCH'
            : '❌ MISSING';
      const detailStr = d.details.join('; ').replace(/\|/g, '\\|');
      tableMd += `| **${d.key}** | ${badge} | ${detailStr} |\n`;
    });

    return {
      summary: {
        totalItemsChecked: total,
        matchCount,
        mismatchCount,
        missingCount,
        matchPercentage,
      },
      discrepancies,
      formattedTableMarkdown: tableMd,
    };
  }

  /**
   * Cross-reference occurrences of a string / entity across multiple documents.
   */
  crossReference(
    query: string,
    documents: Array<{ name: string; content: string }>,
  ): CrossReferenceMatch[] {
    const results: CrossReferenceMatch[] = [];
    const qLower = query.toLowerCase().trim();

    for (const doc of documents) {
      if (!doc.content) continue;
      const text = doc.content;
      const tLower = text.toLowerCase();

      let count = 0;
      let pos = 0;
      let firstMatchIdx = -1;

      while ((pos = tLower.indexOf(qLower, pos)) !== -1) {
        if (firstMatchIdx === -1) firstMatchIdx = pos;
        count++;
        pos += qLower.length;
      }

      if (count > 0) {
        // Extract 150 char snippet around first occurrence
        const start = Math.max(0, firstMatchIdx - 60);
        const end = Math.min(text.length, firstMatchIdx + qLower.length + 60);
        let snippet = text.slice(start, end).replace(/\r?\n/g, ' ').trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        results.push({
          documentName: doc.name,
          matchedText: query,
          contextSnippet: snippet,
          occurrenceCount: count,
        });
      }
    }

    return results;
  }
}
