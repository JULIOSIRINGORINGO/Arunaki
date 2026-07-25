import { Injectable } from '@nestjs/common';

// @ts-ignore
import nlp from 'compromise';
// @ts-ignore
import * as _ from 'lodash';

export interface ExtractResult {
  title: string;
  categoryTotals: Record<string, Record<string, number>>;
  totalCount: number;
  anomalies: string[];
  plainTextOutput: string;
}

@Injectable()
export class TextExtractorTool {
  /**
   * Universal NLP text extractor — works for any document type:
   * invoices, orders, receipts, reports, inventories, etc.
   */
  extractStructuredData(rawText: string, title: string = ''): ExtractResult {
    if (!rawText || !rawText.trim()) {
      return {
        title,
        categoryTotals: {},
        totalCount: 0,
        anomalies: [],
        plainTextOutput: title ? title : '',
      };
    }

    const doc = nlp(rawText);
    const terms = (doc.terms().out('array') || []) as string[];

    const cleanTokens: string[] = _.chain(terms)
      .map((t: any) => String(t).trim())
      .filter((t: any) => String(t).length > 0)
      .value();

    const frequencyMap: Record<string, number> = _.countBy(cleanTokens);
    const totalCount: number = _.sum(Object.values(frequencyMap));

    const lines: string[] = [];
    if (title) {
      lines.push(title);
    }

    _.forEach(frequencyMap, (count: any, item: any) => {
      lines.push(`${String(item)} ${Number(count)}`);
    });

    return {
      title,
      categoryTotals: {
        entities: frequencyMap,
      },
      totalCount,
      anomalies: [],
      plainTextOutput: lines.join('\n'),
    };
  }
}
