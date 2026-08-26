import { Injectable, Logger } from '@nestjs/common';

/**
 * AutoPostureDetector — detects conversation intent for business-oriented AI.
 *
 * Arunaki is an Autonomous Workspace Agent for BUSINESS document work,
 * not a coding agent. This detector prioritizes business/analysis postures
 * over coding/technical ones.
 */
@Injectable()
export class AutoPostureDetector {
  private readonly logger = new Logger(AutoPostureDetector.name);

  /** Posture types - ordered by priority for Arunaki's business focus */
  private readonly postures: PostureConfig[] = [
    {
      type: 'business',
      keywords: [
        // Core business terms (highest weight)
        'bisnis',
        'business',
        'revenue',
        'profit',
        'laba',
        'rugi',
        'sales',
        'penjualan',
        'customer',
        'client',
        'pelanggan',
        'strategy',
        'strategi',
        'rencana',
        'investasi',
        'investment',
        'kpi',
        'roi',
        'modal',
        'capital',

        // Business operations
        'marketing',
        'pemasaran',
        'brand',
        'merk',
        'harga',
        'produk',
        'layanan',
        'operasi',
        'operations',
        'optimasi',
        'pengeluaran',
        'biaya',
        'expense',
        'anggaran',
        'budget',
        'keuangan',
        'finance',
        'financial',
        'arus kas',

        // Analysis & reporting (business context)
        'analisis',
        'analysis',
        'laporan',
        'report',
        'dashboard',
        'insight',
        'insights',
        'tren',
        'trend',
        'data',
        'statistik',
        'statistics',
        'metrik',
        'metrics',
        'perbandingan',
        'comparison',
        'kompetitor',
        'competitor',
        'pasar',
        'market',

        // Document & planning
        'sop',
        'prosedur',
        'procedure',
        'standar',
        'standard',
        'kebijakan',
        'policy',
        'template',
        'rencana kerja',
        'roadmap',
        'target',
        'tujuan',
        'goal',
        'pengelolaan',
        'manajemen',
        'management',
        'organisasi',
        'organization',

        // Garment/manufacturing specific
        'costing',
        'hpp',
        'bom',
        'bill of materials',
        'konsumsi',
        'kain',
        'fabric',
        'ukuran',
        'size',
        'grade',
        'quality control',
        'qc',
        'produksi',
        'production',
      ],
      patterns: [
        // Direct business requests
        /\b(?:analisis|analisis|review|evaluasi|assess)\s+(?:data|penjualan|laporan|keuangan|bisnis|produk)\b/i,
        /\b(?:buat|create|susun|draft)\s+(?:laporan|rencana|proposal|strategi|sop|kebijakan)\b/i,
        /\b(?:berapa|berapa|hitung|calculate)\s+(?:harga|biaya|modal|roi|margin|laba)\b/i,
        /\b(?:bandingkan|compare)\s+(?:kompetitor|produk|harga|vendor|supplier)\b/i,
        /\b(?:optimasi|perbaiki|tingkatkan)\s+(?:penjualan|produktivitas|efisiensi|proses)\b/i,
      ],
      prompt: `BUSINESS POSTURE ACTIVATED:
- Think like a business consultant/analyst
- Focus on actionable business insights and recommendations
- Use business terminology: revenue, margin, ROI, KPI, cash flow, P&L
- Structure responses: Executive Summary → Analysis → Recommendations
- Consider financial implications and business constraints
- Provide measurable outcomes and next steps`,
    },
    {
      type: 'analysis',
      keywords: [
        'analisis',
        'analysis',
        'review',
        'evaluasi',
        'assess',
        'examine',
        'investigate',
        'compare',
        'contrast',
        'pros',
        'cons',
        'advantages',
        'disadvantages',
        'trade-offs',
        'recommend',
        'suggestion',
        'opinion',
        'thoughts',
        'perspective',
        'insight',
        'trend',
        'pattern',
        'correlation',
        'causation',
        'statistics',
        'data',
        'metrics',
        'kpi',
        'dashboard',
        'report',
        'forecast',
        'prediction',
        'model',
      ],
      patterns: [
        /\b(analyze|review|evaluate|assess)\s+(?:the\s+)?(?:data|code|performance|results?)\b/i,
        /\bwhat\s+(?:do\s+you\s+think|are\s+your\s+thoughts|is\s+your\s+opinion)\b/i,
        /\b(compare|contrast)\s+(?:the\s+)?(?:options|approaches|solutions)\b/i,
        /\bpros?\s+and\s+cons?\b/i,
      ],
      prompt: `ANALYSIS POSTURE ACTIVATED:
- Provide structured analysis with clear sections
- Use data and evidence to support conclusions
- Present multiple perspectives when applicable
- Highlight trade-offs and risks
- Give actionable recommendations
- Use frameworks (SWOT, cost-benefit, etc.) when relevant`,
    },
    {
      type: 'creative',
      keywords: [
        'write',
        'story',
        'article',
        'blog',
        'post',
        'content',
        'copy',
        'marketing',
        'email',
        'newsletter',
        'social',
        'tweet',
        'linkedin',
        'caption',
        'headline',
        'slogan',
        'tagline',
        'brand',
        'voice',
        'tone',
        'style',
        'creative',
        'idea',
        'brainstorm',
        'concept',
        'campaign',
        'ad',
        'advertisement',
        'promo',
      ],
      patterns: [
        /\b(write|create|draft)\s+(?:a\s+)?(?:story|article|blog|email|post|copy)\b/i,
        /\b(come\s+up\s+with|brainstorm|generate)\s+(?:ideas?|concepts?|names?)\b/i,
        /\bmarketing\s+(?:copy|content|campaign)\b/i,
      ],
      prompt: `CREATIVE POSTURE ACTIVATED:
- Be engaging, original, and audience-aware
- Use varied sentence structure and vocabulary
- Match the requested tone and brand voice
- Provide multiple options when appropriate
- Hook the reader early
- Include clear calls to action when relevant`,
    },
    {
      type: 'learning',
      keywords: [
        'learn',
        'study',
        'understand',
        'explain',
        'teach',
        'tutorial',
        'guide',
        'how',
        'what',
        'why',
        'concept',
        'theory',
        'principle',
        'fundamental',
        'basic',
        'beginner',
        'introduction',
        'overview',
        'summary',
        'example',
        'definition',
      ],
      patterns: [
        /\b(?:how|what|why)\s+(?:does|is|does\s+it|can\s+i)\b/i,
        /\bexplain\s+(?:me\s+)?(?:the\s+)?(?:concept|idea|theory|principle)\b/i,
        /\b(?:learn|understand)\s+(?:about\s+)?/i,
        /\b(?:tutorial|guide|introduction)\s+(?:to|for)\b/i,
      ],
      prompt: `LEARNING POSTURE ACTIVATED:
- Explain concepts clearly and progressively
- Use analogies and real-world examples
- Break down complex topics into digestible parts
- Check for understanding with summaries
- Provide resources for further learning
- Encourage questions and exploration`,
    },
    {
      type: 'coding',
      keywords: [
        'code',
        'program',
        'function',
        'class',
        'method',
        'variable',
        'loop',
        'array',
        'object',
        'api',
        'endpoint',
        'database',
        'query',
        'sql',
        'html',
        'css',
        'javascript',
        'typescript',
        'python',
        'java',
        'react',
        'vue',
        'angular',
        'node',
        'express',
        'nest',
        'nextjs',
        'debug',
        'error',
        'bug',
        'fix',
        'refactor',
        'optimize',
        'performance',
        'algorithm',
        'git',
        'github',
        'commit',
        'push',
        'pull',
        'merge',
        'branch',
        'deploy',
        'docker',
        'kubernetes',
        'aws',
        'azure',
        'gcp',
        'serverless',
        'lambda',
        'microservice',
        'rest',
        'graphql',
        'grpc',
        'websocket',
        'auth',
        'jwt',
        'oauth',
        'middleware',
      ],
      patterns: [
        /\b(write|create|build|make|implement)\s+(?:a\s+)?(?:function|class|component|api|endpoint)\b/i,
        /\b(fix|debug|solve|resolve)\s+(?:the\s+)?(?:bug|error|issue)\b/i,
        /\bhow\s+to\s+(?:write|create|implement|use)\b/i,
        /\b(code|script|program)\s+(?:for|that|to)\b/i,
      ],
      prompt: `CODING POSTURE ACTIVATED:
- Provide complete, working code examples
- Include error handling and best practices
- Explain complex logic with comments
- Use modern, idiomatic patterns for the language
- Show file structure when relevant
- Mention dependencies and setup if needed`,
    },
    {
      type: 'general',
      keywords: [],
      patterns: [],
      prompt: `GENERAL MODE: Provide helpful, balanced responses suitable for general conversation and questions.`,
    },
  ];

  /** Minimum confidence threshold to switch posture */
  private readonly CONFIDENCE_THRESHOLD = 0.5;

  /**
   * Detect posture from conversation history.
   * Analyzes the last few user messages for intent signals.
   * Prioritizes business posture for Arunaki's document-centric workspace focus.
   */
  detectPostureFromHistory(
    history: Array<{ role: string; content: string }>,
  ): PostureDetectionResult {
    // Get last 5 user messages
    const userMessages = history
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content.toLowerCase())
      .join(' ');

    if (!userMessages.trim()) {
      // Default to business for Arunaki's workspace agent context
      return { posture: 'business', confidence: 0.7, matchedKeywords: [] };
    }

    // Score each posture
    const scores: Record<string, { score: number; matched: string[] }> = {};

    for (const posture of this.postures) {
      let score = 0;
      const matched: string[] = [];

      // Keyword matching
      for (const keyword of posture.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        const matches = userMessages.match(regex);
        if (matches) {
          score += matches.length;
          matched.push(keyword);
        }
      }

      // Pattern matching (higher weight)
      for (const pattern of posture.patterns) {
        if (pattern.test(userMessages)) {
          score += 4; // Higher weight for patterns
          matched.push(pattern.source);
        }
      }

      scores[posture.type] = { score, matched };
    }

    // Find highest scoring posture
    let bestPosture: PostureType = 'business'; // Default to business
    let bestScore = 0;
    let bestMatched: string[] = [];

    for (const [type, { score, matched }] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestPosture = type as PostureType;
        bestMatched = matched;
      }
    }

    // Calculate confidence (0-1)
    const totalSignals = Object.values(scores).reduce(
      (sum, s) => sum + s.score,
      0,
    );
    const confidence =
      totalSignals > 0 ? Math.min(bestScore / totalSignals, 1) : 0.7;

    // Minimum threshold - default to business if uncertain
    if (bestScore < 2) {
      return {
        posture: 'business',
        confidence: Math.max(confidence, 0.6),
        matchedKeywords: [],
      };
    }

    return {
      posture: bestPosture,
      confidence: Math.max(confidence, 0.5),
      matchedKeywords: bestMatched,
    };
  }

  /**
   * Get the prompt addition for a detected posture.
   */
  getPosturePrompt(posture: PostureType): string {
    const config = this.postures.find((p) => p.type === posture);
    return config ? `\n${config.prompt}` : '';
  }
}

/** Posture configuration */
interface PostureConfig {
  type: PostureType;
  keywords: string[];
  patterns: RegExp[];
  prompt: string;
}

/** Supported posture types - ordered by Arunaki priority */
export type PostureType =
  'business' | 'analysis' | 'creative' | 'learning' | 'coding' | 'general';

/** Posture detection result */
export interface PostureDetectionResult {
  posture: PostureType;
  confidence: number;
  matchedKeywords: string[];
}
