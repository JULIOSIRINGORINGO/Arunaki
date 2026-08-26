import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * Indonesian PII pattern definitions.
 * Each pattern has a regex, label, and replacement mask.
 */
interface PiiPattern {
  name: string;
  label: string;
  regex: RegExp;
  mask: string;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    name: 'nik_ktp',
    label: 'NIK/KTP',
    // 16-digit Indonesian national ID, optionally separated by dots/spaces
    regex: /\b(\d{2}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{6}[.\s]?\d{4})\b/g,
    mask: '****-****-****-****',
  },
  {
    name: 'npwp',
    label: 'NPWP',
    // Indonesian tax ID: XX.XXX.XXX.X-XXX.XXX or 15-16 continuous digits
    regex: /\b(\d{2}[.]?\d{3}[.]?\d{3}[.]?\d[-.]?\d{3}[.]?\d{3})\b/g,
    mask: '**.***.***.?-***.***',
  },
  {
    name: 'email',
    label: 'Email',
    regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    mask: '***@***.***',
  },
  {
    name: 'phone_id',
    label: 'Phone (ID)',
    // Indonesian phone: +62xxx, 08xxx, 021-xxx, (021) xxx with word boundary
    regex: /(?:\b\+?62|\b0)[\s-]?(?:\d[\s-]?){8,13}\b/g,
    mask: '+62-***-****-****',
  },
  {
    name: 'credit_card',
    label: 'Credit Card',
    // 13-19 digit card numbers, optionally separated by spaces/dashes
    regex: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7})\b/g,
    mask: '****-****-****-****',
  },
  {
    name: 'bank_account',
    label: 'Bank Account',
    // Indonesian bank account numbers (typically 10-16 digits)
    // We look for patterns like "Rek: 1234567890" or "No. Rekening: 1234567890"
    regex: /((?:rek(?:ening)?|account|no\.?\s*(?:rek|akun))\s*[:.]?\s*)(\d{10,16})/gi,
    mask: '****-****-****',
  },
];

@Injectable()
export class DocRedactTool {
  private readonly logger = new Logger(DocRedactTool.name);

  /**
   * Scan text for PII and return redacted version with detection report.
   */
  redact(
    text: string,
    options?: {
      patterns?: string[];
      customMask?: string;
    },
  ): ToolResult {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Input text is empty.',
        metadata: {
          toolName: 'doc_redact_pii',
          displayName: 'Redact PII',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_INPUT', message: 'Text input is required' },
      };
    }

    // Select which patterns to apply
    const activePatterns = options?.patterns
      ? PII_PATTERNS.filter((p) => options.patterns!.includes(p.name))
      : PII_PATTERNS;

    if (activePatterns.length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'No valid PII patterns selected.',
        metadata: {
          toolName: 'doc_redact_pii',
          displayName: 'Redact PII',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'NO_PATTERNS',
          message: `Valid patterns: ${PII_PATTERNS.map((p) => p.name).join(', ')}`,
        },
      };
    }

    let redactedText = text;
    const detections: Array<{
      type: string;
      label: string;
      count: number;
      samples: string[];
    }> = [];

    let totalRedacted = 0;

    for (const pattern of activePatterns) {
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0;

      const matches: string[] = [];
      let match: RegExpExecArray | null;

      // Clone regex to avoid state issues with global flag
      const clonedRegex = new RegExp(pattern.regex.source, pattern.regex.flags);

      while ((match = clonedRegex.exec(text)) !== null) {
        matches.push(match[0]);
      }

      if (matches.length > 0) {
        const mask = options?.customMask || pattern.mask;

        // Replace all occurrences (preserve prefix label if pattern has 2 capture groups)
        const replaceRegex = new RegExp(pattern.regex.source, pattern.regex.flags);
        if (pattern.name === 'bank_account') {
          redactedText = redactedText.replace(
            replaceRegex,
            (_match, prefix, _digits) => `${prefix}${mask}`,
          );
        } else {
          redactedText = redactedText.replace(replaceRegex, mask);
        }

        totalRedacted += matches.length;

        // Store masked samples (show first 3 chars + mask for audit purposes)
        const samples = matches.slice(0, 3).map((m) => {
          if (m.length > 4) {
            return m.substring(0, 3) + '***' + m.substring(m.length - 2);
          }
          return '***';
        });

        detections.push({
          type: pattern.name,
          label: pattern.label,
          count: matches.length,
          samples,
        });
      }
    }

    const summaryLines = detections.map(
      (d) => `${d.label}: ${d.count} found`,
    );
    const summaryText =
      totalRedacted > 0
        ? `Redacted ${totalRedacted} PII item(s): ${summaryLines.join(', ')}`
        : 'No PII detected in the document.';

    return {
      status: 'success',
      data: {
        redactedText,
        totalRedacted,
        detections,
        patternsChecked: activePatterns.map((p) => p.name),
        originalLength: text.length,
        redactedLength: redactedText.length,
      },
      preview: summaryText,
      metadata: {
        toolName: 'doc_redact_pii',
        displayName: 'Redact PII',
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Scan text for PII without redacting — detection-only mode.
   */
  scan(text: string): ToolResult {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      return {
        status: 'success',
        data: { detections: [], totalFound: 0 },
        preview: 'No text to scan.',
        metadata: {
          toolName: 'doc_redact_pii',
          displayName: 'Scan PII',
          executionTime: Date.now() - startTime,
        },
      };
    }

    const detections: Array<{
      type: string;
      label: string;
      count: number;
    }> = [];

    let totalFound = 0;

    for (const pattern of PII_PATTERNS) {
      const clonedRegex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let count = 0;
      while (clonedRegex.exec(text) !== null) {
        count++;
      }
      if (count > 0) {
        totalFound += count;
        detections.push({
          type: pattern.name,
          label: pattern.label,
          count,
        });
      }
    }

    const summaryLines = detections.map(
      (d) => `${d.label}: ${d.count}`,
    );

    return {
      status: 'success',
      data: { detections, totalFound },
      preview:
        totalFound > 0
          ? `⚠️ Found ${totalFound} PII item(s): ${summaryLines.join(', ')}`
          : '✅ No PII detected.',
      metadata: {
        toolName: 'doc_redact_pii',
        displayName: 'Scan PII',
        executionTime: Date.now() - startTime,
      },
    };
  }
}
