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
      if (row[matchKey] !== undefined) return String(row[matchKey]).trim().toLowerCase();
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
          sourceValues: { [sourceName]: srcVal, [targetName]: null },
          hasMismatch: true,
          status: 'MISSING_IN_TARGET',
          details: [`Entri "${key}" ditemukan di ${sourceName} tetapi tidak ada di ${targetName}`],
        });
      } else if (!srcVal && tgtVal) {
        missingCount++;
        discrepancies.push({
          key,
          sourceValues: { [sourceName]: null, [targetName]: tgtVal },
          hasMismatch: true,
          status: 'MISSING_IN_SOURCE',
          details: [`Entri "${key}" ditemukan di ${targetName} tetapi tidak ada di ${sourceName}`],
        });
      } else if (srcVal && tgtVal) {
        const details: string[] = [];
        let hasMismatch = false;

        // Compare all matching fields
        const allFields = new Set([
          ...Object.keys(srcVal),
          ...Object.keys(tgtVal),
        ]);

        for (const field of allFields) {
          const v1 = srcVal[field];
          const v2 = tgtVal[field];

          if (v1 !== undefined && v2 !== undefined) {
            // String/Number comparison
            const s1 = String(v1).trim();
            const s2 = String(v2).trim();
            if (s1.toLowerCase() !== s2.toLowerCase()) {
              // Try numeric parse comparison
              const n1 = parseFloat(s1.replace(/[^0-9.-]+/g, ''));
              const n2 = parseFloat(s2.replace(/[^0-9.-]+/g, ''));
              if (isNaN(n1) || isNaN(n2) || Math.abs(n1 - n2) > 0.01) {
                hasMismatch = true;
                details.push(
                  `Field "${field}" berbeda: ${sourceName} = "${s1}" vs ${targetName} = "${s2}"`,
                );
              }
            }
          }
        }

        if (hasMismatch) {
          mismatchCount++;
          discrepancies.push({
            key,
            sourceValues: { [sourceName]: srcVal, [targetName]: tgtVal },
            hasMismatch: true,
            status: 'MISMATCH',
            details,
          });
        } else {
          matchCount++;
          discrepancies.push({
            key,
            sourceValues: { [sourceName]: srcVal, [targetName]: tgtVal },
            hasMismatch: false,
            status: 'MATCH',
            details: ['Data cocok sempurna'],
          });
        }
      }
    }

    const total = allKeys.size;
    const matchPercentage = total > 0 ? Math.round((matchCount / total) * 100) : 100;

    // Construct Markdown Audit Table
    const tableHeader = `| ID / Kunci | Status Rekonsiliasi | Catatan Selisih / Perbedaan |\n| --- | --- | --- |\n`;
    const tableRows = discrepancies
      .map((d) => {
        const badge =
          d.status === 'MATCH'
            ? '✅ COCOK'
            : d.status === 'MISMATCH'
              ? '⚠️ SELISIH'
              : '❌ TIDAK ADA';
        return `| **${d.key}** | ${badge} | ${d.details.join('; ')} |`;
      })
      .join('\n');

    const formattedTableMarkdown = `[CANVAS]\n### 📊 Laporan Audit & Rekonsiliasi Dokumen\n\n**Sumber:** \`${sourceName}\` vs \`${targetName}\`  \n**Total Entri:** ${total} | **Cocok:** ${matchCount} | **Selisih:** ${mismatchCount} | **Hilang:** ${missingCount} | **Akurasi:** ${matchPercentage}%\n\n${tableHeader}${tableRows}\n[/CANVAS]`;

    return {
      summary: {
        totalItemsChecked: total,
        matchCount,
        mismatchCount,
        missingCount,
        matchPercentage,
      },
      discrepancies,
      formattedTableMarkdown,
    };
  }

  /**
   * Search for exact or fuzzy occurrences of a query string across multiple text documents.
   */
  crossReference(
    query: string,
    documents: Array<{ name: string; content: string }>,
  ): CrossReferenceMatch[] {
    if (!query || !documents) return [];

    const lowerQuery = query.toLowerCase().trim();
    const results: CrossReferenceMatch[] = [];

    for (const doc of documents) {
      if (!doc.content) continue;
      const lowerContent = doc.content.toLowerCase();
      let pos = 0;
      let count = 0;
      let snippet = '';

      while ((pos = lowerContent.indexOf(lowerQuery, pos)) !== -1) {
        count++;
        if (!snippet) {
          const start = Math.max(0, pos - 40);
          const end = Math.min(doc.content.length, pos + lowerQuery.length + 40);
          snippet = `...${doc.content.substring(start, end).replace(/\n/g, ' ')}...`;
        }
        pos += lowerQuery.length;
      }

      if (count > 0) {
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
