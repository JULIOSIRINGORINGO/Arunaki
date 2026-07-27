import { Injectable, Logger } from '@nestjs/common';

/**
 * PromptInjectionDetector — scans user input for injection attempts.
 *
 * Inspired OpenClaw's injection detection. Scans for common
 * prompt injection patterns and blocks/flags suspicious inputs.
 */
@Injectable()
export class PromptInjectionDetector {
  private readonly logger = new Logger(PromptInjectionDetector.name);

  /** Patterns that indicate potential prompt injection */
  private readonly injectionPatterns = [
    // Ignore previous instructions
    { pattern: /ignore\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/i, severity: 'high', type: 'ignore_instructions' },
    { pattern: /disregard\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/i, severity: 'high', type: 'ignore_instructions' },
    { pattern: /forget\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/i, severity: 'high', type: 'ignore_instructions' },

    // Role override attempts
    { pattern: /you\s+are\s+(?:now\s+)?(?:a\s+)?(?:hacker|admin|root|developer|system|god)/i, severity: 'high', type: 'role_override' },
    { pattern: /act\s+as\s+(?:a\s+)?(?:hacker|admin|root|developer|system|god)/i, severity: 'high', type: 'role_override' },
    { pattern: /pretend\s+(?:to\s+be\s+)?(?:a\s+)?(?:hacker|admin|root|developer|system|god)/i, severity: 'high', type: 'role_override' },
    { pattern: /simulate\s+(?:a\s+)?(?:hacker|admin|root|developer|system|god)/i, severity: 'high', type: 'role_override' },

    // System prompt extraction
    { pattern: /(?:show|reveal|print|output|display)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/i, severity: 'high', type: 'prompt_extraction' },
    { pattern: /what\s+(?:are\s+)?(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/i, severity: 'medium', type: 'prompt_extraction' },
    { pattern: /repeat\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/i, severity: 'high', type: 'prompt_extraction' },

    // Tool/Function manipulation
    { pattern: /(?:call|invoke|execute|run)\s+(?:function|tool)\s+(?:without|bypass|skip)/i, severity: 'high', type: 'tool_manipulation' },
    { pattern: /bypass\s+(?:security|safety|validation|checks?)/i, severity: 'high', type: 'tool_manipulation' },

    // Data exfiltration
    { pattern: /(?:send|post|upload|exfiltrate)\s+(?:data|info|secrets?|keys?|tokens?)/i, severity: 'high', type: 'data_exfiltration' },
    { pattern: /(?:what|show)\s+(?:is\s+)?(?:your\s+)?(?:api\s+key|secret|password|token)/i, severity: 'high', type: 'data_exfiltration' },

    // Jailbreak patterns
    { pattern: /DAN|do\s+anything\s+now/i, severity: 'high', type: 'jailbreak' },
    { pattern: /STAN|strive\s+to\s+avoid\s+norms/i, severity: 'high', type: 'jailbreak' },
    { pattern: /MONG|model\s+output\s+no\s+guardrails/i, severity: 'high', type: 'jailbreak' },
    { pattern: /developer\s+mode/i, severity: 'medium', type: 'jailbreak' },

    // Chain of thought extraction
    { pattern: /(?:show|reveal|print)\s+(?:your\s+)?(?:reasoning|thinking|chain\s+of\s+thought)/i, severity: 'medium', type: 'cot_extraction' },
    { pattern: /what\s+(?:were\s+)?(?:you\s+)?thinking/i, severity: 'low', type: 'cot_extraction' },

    // Encoding/obfuscation attempts
    { pattern: /(?:base64|rot13|hex|url\s*encod)/i, severity: 'medium', type: 'obfuscation' },
    { pattern: /\\x[0-9a-f]{2}/i, severity: 'medium', type: 'obfuscation' },
    { pattern: /%[0-9a-f]{2}/i, severity: 'low', type: 'obfuscation' },

    // Emotional manipulation
    { pattern: /(?:please|urgent|emergency|help\s+me)\s+.*(?:ignore|bypass|override)/i, severity: 'medium', type: 'emotional_manipulation' },
    { pattern: /(?:my\s+(?:grandma|mother|father|child|dog)\s+(?:died|is\s+dying|will\s+die))/i, severity: 'medium', type: 'emotional_manipulation' },

    // Continuation attacks
    { pattern: /continue\s+(?:the\s+)?(?:above|previous)\s+(?:text|response|output)/i, severity: 'low', type: 'continuation' },
    { pattern: /complete\s+(?:the\s+)?(?:above|previous)\s+(?:text|response|output)/i, severity: 'low', type: 'continuation' },
  ];

  /** Sanitization patterns - remove potentially dangerous content */
  private readonly sanitizationPatterns = [
    { pattern: /ignore\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi, replacement: '[REDACTED: ignore instructions]' },
    { pattern: /disregard\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi, replacement: '[REDACTED: disregard instructions]' },
    { pattern: /you\s+are\s+(?:now\s+)?(?:a\s+)?(?:hacker|admin|root|developer|system|god)/gi, replacement: '[REDACTED: role override]' },
    { pattern: /act\s+as\s+(?:a\s+)?(?:hacker|admin|root|developer|system|god)/gi, replacement: '[REDACTED: role override]' },
    { pattern: /show\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?)/gi, replacement: '[REDACTED: prompt extraction]' },
    { pattern: /DAN|do\s+anything\s+now/gi, replacement: '[REDACTED: jailbreak]' },
    { pattern: /developer\s+mode/gi, replacement: '[REDACTED: developer mode]' },
  ];

  /**
   * Scan text for prompt injection attempts.
   */
  scan(text: string): InjectionDetectionResult {
    if (!text || text.length === 0) {
      return { detected: false, severity: 'none', type: 'none', sanitized: text, matches: [] };
    }

    const matches: Array<{ type: string; severity: string; match: string }> = [];
    let maxSeverity: 'none' | 'low' | 'medium' | 'high' = 'none';

    // Check for injection patterns
    for (const { pattern, severity, type } of this.injectionPatterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push({ type, severity, match: match[0] });
        if (this.severityWeight(severity) > this.severityWeight(maxSeverity)) {
          maxSeverity = severity as 'low' | 'medium' | 'high';
        }
      }
    }

    // Sanitize if any matches found
    let sanitized = text;
    if (matches.length > 0) {
      sanitized = this.sanitize(text);
    }

    return {
      detected: matches.length > 0,
      severity: maxSeverity,
      type: matches[0]?.type || 'none',
      sanitized,
      matches,
    };
  }

  /**
   * Sanitize text by removing/replacing injection patterns.
   */
  sanitize(text: string): string {
    let result = text;
    for (const { pattern, replacement } of this.sanitizationPatterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * Log injection detection for security monitoring.
   */
  logDetection(chatId: string, originalText: string, result: InjectionDetectionResult): void {
    this.logger.warn(
      `Prompt injection detected in chat ${chatId}: ${result.severity} severity, type: ${result.type}, matches: ${result.matches.length}`,
    );

    // In production, you'd want to store this in a security log table
    // For now, just log it
    if (result.severity === 'high') {
      this.logger.error(`HIGH SEVERITY INJECTION: ${JSON.stringify(result.matches)}`);
    }
  }

  /**
   * Get numeric weight for severity comparison.
   */
  private severityWeight(severity: string): number {
    const weights: Record<string, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
    };
    return weights[severity] || 0;
  }
}

/** Result of injection detection scan */
export interface InjectionDetectionResult {
  detected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  type: string;
  sanitized: string;
  matches: Array<{ type: string; severity: string; match: string }>;
}