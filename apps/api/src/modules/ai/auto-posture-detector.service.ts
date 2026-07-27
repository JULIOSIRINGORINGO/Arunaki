import { Injectable, Logger } from '@nestjs/common';

/**
 * AutoPostureDetector — detects conversation intent (general vs coding vs analysis etc.)
 *
 * Inspired by Hermes's posture detection. Automatically identifies the user's
 * intent from conversation history and adds appropriate prompt guidance.
 */
@Injectable()
export class AutoPostureDetector {
  private readonly logger = new Logger(AutoPostureDetector.name);

  /** Posture types */
  private readonly postures: PostureConfig[] = [
    {
      type: 'coding',
      keywords: [
        'code', 'program', 'function', 'class', 'method', 'variable', 'loop', 'array', 'object',
        'api', 'endpoint', 'database', 'query', 'sql', 'html', 'css', 'javascript', 'typescript',
        'python', 'java', 'react', 'vue', 'angular', 'node', 'express', 'nest', 'nextjs',
        'debug', 'error', 'bug', 'fix', 'refactor', 'optimize', 'performance', 'algorithm',
        'git', 'github', 'commit', 'push', 'pull', 'merge', 'branch', 'deploy', 'docker',
        'kubernetes', 'aws', 'azure', 'gcp', 'serverless', 'lambda', 'microservice',
        'rest', 'graphql', 'grpc', 'websocket', 'auth', 'jwt', 'oauth', 'middleware',
      ],
      patterns: [
        /\b(write|create|build|make|implement)\s+(?:a\s+)?(?:function|class|component|api|endpoint)/i,
        /\b(fix|debug|solve|resolve)\s+(?:the\s+)?(?:bug|error|issue)/i,
        /\bhow\s+to\s+(?:write|create|implement|use)/i,
        /\b(code|script|program)\s+(?:for|that|to)/i,
      ],
      prompt: `CODING MODE ACTIVATED:
- Provide complete, working code examples
- Include error handling and best practices
- Explain complex logic with comments
- Use modern, idiomatic patterns for the language
- Show file structure when relevant
- Mention dependencies and setup if needed`,
    },
    {
      type: 'analysis',
      keywords: [
        'analyze', 'analysis', 'review', 'evaluate', 'assess', 'examine', 'investigate',
        'compare', 'contrast', 'pros', 'cons', 'advantages', 'disadvantages', 'trade-offs',
        'recommend', 'suggestion', 'opinion', 'thoughts', 'perspective', 'insight',
        'trend', 'pattern', 'correlation', 'causation', 'statistics', 'data', 'metrics',
        'kpi', 'dashboard', 'report', 'forecast', 'prediction', 'model',
      ],
      patterns: [
        /\b(analyze|review|evaluate|assess)\s+(?:the\s+)?(?:data|code|performance|results?)/i,
        /\bwhat\s+(?:do\s+you\s+think|are\s+your\s+thoughts|is\s+your\s+opinion)/i,
        /\b(compare|contrast)\s+(?:the\s+)?(?:options|approaches|solutions)/i,
        /\bpros?\s+and\s+cons?/i,
      ],
      prompt: `ANALYSIS MODE ACTIVATED:
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
        'write', 'story', 'article', 'blog', 'post', 'content', 'copy', 'marketing',
        'email', 'newsletter', 'social', 'tweet', 'linkedin', 'caption', 'headline',
        'slogan', 'tagline', 'brand', 'voice', 'tone', 'style', 'creative', 'idea',
        'brainstorm', 'concept', 'campaign', 'ad', 'advertisement', 'promo',
      ],
      patterns: [
        /\b(write|create|draft)\s+(?:a\s+)?(?:story|article|blog|email|post|copy)/i,
        /\b(come\s+up\s+with|brainstorm|generate)\s+(?:ideas?|concepts?|names?)/i,
        /\bmarketing\s+(?:copy|content|campaign)/i,
      ],
      prompt: `CREATIVE MODE ACTIVATED:
- Be engaging, original, and audience-aware
- Use varied sentence structure and vocabulary
- Match the requested tone and brand voice
- Provide multiple options when appropriate
- Hook the reader early
- Include clear calls to action when relevant`,
    },
    {
      type: 'business',
      keywords: [
        'business', 'strategy', 'plan', 'revenue', 'profit', 'cost', 'budget', 'financial',
        'market', 'customer', 'client', 'sales', 'lead', 'conversion', 'funnel', 'roi',
        'startup', 'company', 'organization', 'team', 'management', 'leadership',
        'operations', 'process', 'workflow', 'efficiency', 'productivity', 'kpi',
        'investment', 'funding', 'valuation', 'equity', 'stakeholder', 'partner',
      ],
      patterns: [
        /\b(business|strategic)\s+(?:plan|strategy|model)/i,
        /\b(?:increase|improve|optimize)\s+(?:revenue|sales|profit|conversion)/i,
        /\b(?:market|customer|competitor)\s+(?:research|analysis|strategy)/i,
        /\bhow\s+(?:to|can\s+we)\s+(?:grow|scale|improve)\s+(?:the\s+)?business/i,
      ],
      prompt: `BUSINESS MODE ACTIVATED:
- Focus on practical, actionable business advice
- Consider ROI, resources, and constraints
- Reference industry best practices
- Address stakeholders and organizational dynamics
- Provide measurable outcomes and timelines
- Balance short-term wins with long-term strategy`,
    },
    {
      type: 'learning',
      keywords: [
        'learn', 'study', 'understand', 'explain', 'teach', 'tutorial', 'guide', 'how',
        'what', 'why', 'concept', 'theory', 'principle', 'fundamental', 'basic',
        'beginner', 'introduction', 'overview', 'summary', 'example', 'definition',
      ],
      patterns: [
        /\b(?:how|what|why)\s+(?:does|is|does\s+it|can\s+i)/i,
        /\bexplain\s+(?:me\s+)?(?:the\s+)?(?:concept|idea|theory|principle)/i,
        /\b(?:learn|understand)\s+(?:about\s+)?/i,
        /\b(?:tutorial|guide|introduction)\s+(?:to|for)/i,
      ],
      prompt: `LEARNING MODE ACTIVATED:
- Explain concepts clearly and progressively
- Use analogies and real-world examples
- Break down complex topics into digestible parts
- Check for understanding with summaries
- Provide resources for further learning
- Encourage questions and exploration`,
    },
    {
      type: 'general',
      keywords: [],
      patterns: [],
      prompt: `GENERAL MODE: Provide helpful, balanced responses suitable for general conversation and questions.`,
    },
  ];

  /**
   * Detect posture from conversation history.
   * Analyzes the last few user messages for intent signals.
   */
  detectPostureFromHistory(
    history: Array<{ role: string; content: string }>
  ): PostureDetectionResult {
    // Get last 5 user messages
    const userMessages = history
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content.toLowerCase())
      .join(' ');

    if (!userMessages.trim()) {
      return { posture: 'general', confidence: 0.5, matchedKeywords: [] };
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
          score += 3;
          matched.push(pattern.source);
        }
      }

      scores[posture.type] = { score, matched };
    }

    // Find highest scoring posture (excluding 'general')
    let bestPosture = 'general';
    let bestScore = 0;
    let bestMatched: string[] = [];

    for (const [type, { score, matched }] of Object.entries(scores)) {
      if (type !== 'general' && score > bestScore) {
        bestScore = score;
        bestPosture = type;
        bestMatched = matched;
      }
    }

    // Calculate confidence (0-1)
    const totalSignals = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const confidence = totalSignals > 0 ? Math.min(bestScore / totalSignals, 1) : 0.5;

    // Minimum threshold
    if (bestScore < 2) {
      return { posture: 'general', confidence: 0.5, matchedKeywords: [] };
    }

    return {
      posture: bestPosture as PostureType,
      confidence: Math.max(confidence, 0.3),
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

/** Supported posture types */
export type PostureType =
  | 'coding'
  | 'analysis'
  | 'creative'
  | 'business'
  | 'learning'
  | 'general';

/** Posture detection result */
export interface PostureDetectionResult {
  posture: PostureType;
  confidence: number;
  matchedKeywords: string[];
}