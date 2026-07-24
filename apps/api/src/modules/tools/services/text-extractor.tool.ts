import { Injectable } from '@nestjs/common';

// @ts-ignore
import nlp from 'compromise';
// @ts-ignore
import * as _ from 'lodash';

export interface UniversalParseResult {
  title: string;
  categoryTotals: Record<string, Record<string, number>>;
  totalCount: number;
  anomalies: string[];
  plainTextOutput: string;
}

@Injectable()
export class TextExtractorTool {
  /**
   * Industry-standard Open-Source NLP Entity Extractor & Data Aggregator using `compromise` + `lodash`.
   */
  parseWithNlp(rawText: string, title: string = ''): UniversalParseResult {
    if (!rawText || !rawText.trim()) {
      return {
        title,
        categoryTotals: {},
        totalCount: 0,
        anomalies: [],
        plainTextOutput: title ? title : '',
      };
    }

    // Process natural language text with open-source NLP library 'compromise'
    const doc = nlp(rawText);

    // Open-source NLP extraction: terms and values
    const terms = (doc.terms().out('array') || []) as string[];

    // Use lodash to clean, group, and aggregate frequency counts
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

    // Render plain text using lodash sorted output
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

  // Alias for backward compatibility
  parseGarmentOrder(rawText: string): UniversalParseResult {
    return this.parseWithNlp(rawText, '');
  }
}
