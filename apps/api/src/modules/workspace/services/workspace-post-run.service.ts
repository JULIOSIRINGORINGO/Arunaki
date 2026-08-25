import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { MemoryService } from '../../memory/memory.service.js';
import { BackgroundReviewService } from '../../memory/background-review.service.js';
import { WorkspaceRunState } from './workspace-run-state.service';

export interface PostRunHooksParams {
  workspaceId: string;
  userGoal: string;
  finalContent: string;
  runState: WorkspaceRunState;
  modifiedFiles: string[];
  messages: any[];
}

@Injectable()
export class WorkspacePostRunService {
  private readonly logger = new Logger(WorkspacePostRunService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MemoryService))
    private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => BackgroundReviewService))
    private readonly backgroundReviewService: BackgroundReviewService,
  ) {}

  executePostRunHooks(params: PostRunHooksParams): void {
    const {
      workspaceId,
      userGoal,
      finalContent,
      runState,
      modifiedFiles,
      messages,
    } = params;

    const memoryDetails = {
      goal: userGoal,
      result: finalContent.substring(0, 500),
      modifiedFiles: modifiedFiles,
      totalRounds: runState.round,
      timestamp: new Date().toISOString(),
    };

    setImmediate(async () => {
      try {
        await this.prisma.workspace
          .update({
            where: { id: workspaceId },
            data: {
              analysisResult: finalContent,
              analyzedAt: new Date(),
            },
          })
          .catch((e: any) =>
            this.logger.warn(`Failed to cache analysis result: ${e.message}`),
          );

        let saveDomain = 'generic';
        try {
          const ws = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { businessType: true },
          });
          if (ws?.businessType) saveDomain = ws.businessType;
        } catch {}

        await this.memoryService
          .recordWorkspaceHistory(
            workspaceId,
            `Goal: ${userGoal}\nResult: ${finalContent.substring(0, 500)}`,
            saveDomain,
          )
          .catch(() => {});

        await this.memoryService
          .remember({
            type: 'run_summary',
            key: `run_${workspaceId}_${Date.now()}`,
            content: JSON.stringify(memoryDetails),
            source: 'auto',
            importance: 6,
            domain: saveDomain,
            workspaceId,
          })
          .catch(() => {});

        await this.backgroundReviewService
          .reviewAndLearn(
            messages.map((m) => ({ role: m.role as any, content: m.content || '' })),
            workspaceId,
            saveDomain,
          )
          .catch(() => {});
      } catch (e: any) {
        this.logger.warn(`Background post-processing warning: ${e.message}`);
      }
    });
  }
}
