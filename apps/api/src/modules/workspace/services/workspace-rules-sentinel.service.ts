import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkspaceCartographerService } from './workspace-cartographer.service.js';
import { AiService } from '../../ai/ai.service.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';

export interface AgentTurnEvent {
  workspaceId: string;
  goal?: string;
  userMessage?: string;
  finalContent?: string;
  messages?: Array<{ role: string; content: string }>;
  timestamp?: Date;
}

@Injectable()
export class WorkspaceRulesSentinelService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceRulesSentinelService.name);

  // Regex intent signals indicating potential user rules, constraints, or corrections
  private readonly INTENT_TRIGGER_REGEX =
    /(?:jangan|mulai sekarang|salah|ganti|koreksi|aturan|harus|ingat|selalu|ubah|jangan lupa|preferensi|format|rumus|tiap kali|setiap kali|bukan|seharusnya|tambahkan ke aturan)/i;

  constructor(
    @Inject(forwardRef(() => WorkspaceCartographerService))
    private readonly cartographerService: WorkspaceCartographerService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log(
      '🛡️ Workspace Rules Sentinel Agent initialized (Resident & Event-Driven).',
    );
  }

  /**
   * Event listener for completed workspace agent turns.
   * Wakes up asynchronously in the background — 0ms blocking to the main chat.
   */
  @OnEvent('workspace.agent.completed', { async: true })
  async handleWorkspaceTurnCompleted(event: AgentTurnEvent): Promise<void> {
    if (!event.workspaceId) return;

    try {
      const messages: Array<{ role: string; content: string }> =
        event.messages || [];
      if (messages.length === 0 && event.goal) {
        messages.push({ role: 'user', content: event.goal });
        if (event.finalContent) {
          messages.push({ role: 'assistant', content: event.finalContent });
        }
      }

      await this.inspectAndEvolveRules(event.workspaceId, messages);
    } catch (err: any) {
      this.logger.warn(
        `[RulesSentinel] Sentinel review warning: ${err.message}`,
      );
    }
  }

  /**
   * Core Sentinel engine: Compares user turn directives against current ARUNAKI.md,
   * detects discrepancies or new rules, and autonomously patches ARUNAKI.md.
   */
  async inspectAndEvolveRules(
    workspaceId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<boolean> {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return false;

    // Fast check: Verify if any user message contains rule/correction signals
    const hasIntentSignal = userMessages.some((m) =>
      this.INTENT_TRIGGER_REGEX.test(m.content),
    );
    if (!hasIntentSignal) {
      // No rule or correction signals -> go back to sleep immediately (0ms overhead)
      return false;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true, name: true },
    });

    if (!workspace?.rootPath) return false;

    const currentRules = await this.cartographerService.getWorkspaceRules(
      workspace.rootPath,
    );
    const combinedUserText = userMessages.map((m) => m.content).join('\n---\n');

    this.logger.log(
      `[RulesSentinel] 🛡️ Sentinel detected rule signals in turn for "${workspace.name}". Analyzing diff against ARUNAKI.md...`,
    );

    try {
      const prompt = `You are the Arunaki Living Rules Sentinel Agent.
Your job is to safeguard and evolve the workspace's ARUNAKI.md rulebook.

USER DIRECTIVES:
${combinedUserText.slice(0, 1500)}

CURRENT ARUNAKI.MD RULES:
${currentRules.slice(0, 3000)}

TASK:
Determine if the user's message introduces a NEW rule, UPDATES/REPLACES an existing learned rule, or requires NO changes.

OPTIONS:
1. If NO new rule or operational constraint was changed: output strictly "NO_CHANGE".
2. If the user's message MODIFIES, OVERRIDES, or REPLACES a previous learned rule under "User Preferences & Learned Corrections":
   Output format:
   REPLACE: [snippet from the old learned rule to replace] -> [new concise actionable rule]
3. If it is a completely NEW rule that does not conflict with existing rules:
   Output format:
   ADD: [new concise actionable rule]

Output ONLY "NO_CHANGE", "REPLACE: <old> -> <new>", or "ADD: <new>".`;

      const response = await this.aiService.chat([
        {
          role: 'system',
          content:
            'You are an expert system rulebook sentinel analyzing conversation diffs to maintain live instructions.',
        },
        { role: 'user', content: prompt },
      ]);

      const result = response?.content?.trim() || 'NO_CHANGE';
      if (
        result === 'NO_CHANGE' ||
        result.length < 5 ||
        result.toLowerCase().includes('no_change')
      ) {
        this.logger.debug(
          '[RulesSentinel] No rule changes needed. Sentinel returning to idle.',
        );
        return false;
      }

      // Parse multi-line LLM output — each line may contain ADD: or REPLACE:
      const lines = result
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      let patched = false;
      for (const line of lines) {
        // Skip garbage: error messages, apologies, unparsed prefixes
        if (
          line.toLowerCase().includes('sorry') ||
          line.toLowerCase().includes('unable') ||
          line.toLowerCase().includes('try again')
        ) {
          continue;
        }
        if (line.startsWith('ADD:') || line.startsWith('REPLACE:')) {
          await this.cartographerService.patchWorkspaceRules(workspaceId, line);
          patched = true;
        } else if (line.startsWith('- [Auto-Learned')) {
          // Already formatted rule — pass through
          await this.cartographerService.patchWorkspaceRules(workspaceId, line);
          patched = true;
        }
      }

      if (patched) {
        this.logger.log(
          `[RulesSentinel] 🛡️ Sentinel evolved ARUNAKI.md from ${lines.length} line(s)`,
        );
      }
      return patched;
    } catch (err: any) {
      this.logger.warn(
        `[RulesSentinel] Rule evolution check skipped: ${err.message}`,
      );
      return false;
    }
  }
}
