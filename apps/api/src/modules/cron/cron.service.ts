import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { DocumentGeneratorTool } from '../tools/services/document-generator.tool.js';
import { AutoMemoryService } from '../memory/auto-memory.service.js';
import { SkillService } from '../skills/skill.service.js';
import { WorkspaceRunnerService } from '../workspace/workspace-runner.service.js';

export interface CreateScheduleDto {
  workspaceId: string;
  name: string;
  reportType?: string; // laba_rugi, rug, neraca, stok, agent_run
  cronExpr?: string; // e.g. "daily", "weekly", "monthly", or standard cron expression
  format?: string; // excel, pdf, csv
  agentGoal?: string; // For agent_run type: the goal to execute
}

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private timerHandle: NodeJS.Timeout | null = null;
  private autoMemoryHandle: NodeJS.Timeout | null = null;
  private autoMemoryIntervalMs = 5 * 60 * 1000; // 5 minutes
  private backgroundCuratorHandle: NodeJS.Timeout | null = null;
  private backgroundCuratorIntervalMs = 60 * 60 * 1000; // 1 hour
  private memoryConsolidationHandle: NodeJS.Timeout | null = null;
  private memoryConsolidationIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
  private runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifactService: ArtifactService,
    private readonly documentGenerator: DocumentGeneratorTool,
    private readonly autoMemoryService: AutoMemoryService,
    private readonly skillService: SkillService,
    private readonly workspaceRunner: WorkspaceRunnerService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Cron & Scheduled Reports Engine...');
    // Start interval runner every 60 seconds to check due jobs
    this.timerHandle = setInterval(() => {
      this.checkAndRunDueSchedules().catch((err) => {
        this.logger.error(`Error in scheduler tick: ${err.message}`);
      });
    }, 60000);

    // Start auto-memory distillation interval (every 5 minutes)
    this.autoMemoryHandle = setInterval(() => {
      this.runAutoMemoryDistillation().catch((err) => {
        this.logger.error(`Error in auto-memory distillation: ${err.message}`);
      });
    }, this.autoMemoryIntervalMs);
    this.logger.log(
      `Auto-memory distillation scheduled every ${this.autoMemoryIntervalMs / 1000}s`,
    );

    // Start background curator interval (every 1 hour)
    this.backgroundCuratorHandle = setInterval(() => {
      this.runBackgroundCurator().catch((err) => {
        this.logger.error(`Error in background curator: ${err.message}`);
      });
    }, this.backgroundCuratorIntervalMs);
    this.logger.log(
      `Background curator scheduled every ${this.backgroundCuratorIntervalMs / 1000}s`,
    );

    // Start memory consolidation interval (every 6 hours)
    this.memoryConsolidationHandle = setInterval(() => {
      this.runMemoryConsolidation().catch((err) => {
        this.logger.error(`Error in memory consolidation: ${err.message}`);
      });
    }, this.memoryConsolidationIntervalMs);
    this.logger.log(
      `Memory consolidation scheduled every ${this.memoryConsolidationIntervalMs / 1000 / 60}min`,
    );
  }

  /**
   * Get all scheduled reports for a workspace.
   */
  async getSchedules(workspaceId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new scheduled job (report or agent run).
   */
  async createSchedule(dto: CreateScheduleDto) {
    const isAgentRun = dto.reportType === 'agent_run';
    return this.prisma.scheduledReport.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        reportType: dto.reportType || 'laba_rugi',
        cronExpr: dto.cronExpr || (isAgentRun ? '0 9 * * *' : '0 17 * * *'), // Default 9am for agent runs
        format: dto.format || 'excel',
        active: true,
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        goal: isAgentRun ? dto.agentGoal || '' : null,
      },
    });
  }

  /**
   * Toggle active status.
   */
  async toggleSchedule(id: string, workspaceId: string) {
    const existing = await this.prisma.scheduledReport.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error('Schedule not found or access denied.');
    }

    return this.prisma.scheduledReport.update({
      where: { id },
      data: { active: !existing.active },
    });
  }

  /**
   * Delete a scheduled report.
   */
  async deleteSchedule(id: string, workspaceId: string) {
    const existing = await this.prisma.scheduledReport.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error('Schedule not found or access denied.');
    }
    return this.prisma.scheduledReport.delete({ where: { id } });
  }

  /**
   * Immediately trigger a report generation (manual run test).
   */
  async triggerScheduleRun(id: string) {
    const schedule = await this.prisma.scheduledReport.findUnique({
      where: { id },
    });
    if (!schedule) throw new Error('Schedule not found');

    return this.executeReportGeneration(schedule);
  }

  /**
   * Check for due scheduled jobs and execute them.
   */
  private async checkAndRunDueSchedules() {
    const now = new Date();
    const dueJobs = await this.prisma.scheduledReport.findMany({
      where: {
        active: true,
        OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
      },
    });

    for (const job of dueJobs) {
      // ponytail: in-memory claim set; per-job row lock or queue if multiple instances matter
      if (this.runningJobs.has(job.id)) continue;
      this.runningJobs.add(job.id);
      try {
        if (job.reportType === 'agent_run') {
          await this.executeAgentRun(job);
        } else {
          await this.executeReportGeneration(job);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to execute scheduled job "${job.name}": ${err.message}`,
        );
      } finally {
        this.runningJobs.delete(job.id);
      }
    }
  }

  /**
   * Run auto-memory distillation across all workspaces.
   * Called periodically (default: every 5 minutes).
   */
  private async runAutoMemoryDistillation(): Promise<void> {
    try {
      // Get all active workspaces
      const workspaces = await this.prisma.workspace.findMany({
        where: { status: 'ready' },
        select: { id: true, businessType: true },
      });

      if (workspaces.length === 0) {
        return;
      }

      this.logger.log(`Running auto-memory distillation for ${workspaces.length} workspaces...`);

      for (const ws of workspaces) {
        try {
          const result = await this.autoMemoryService.checkAndDistill(
            ws.id,
            ws.businessType || 'generic',
          );
          if (result.distilled) {
            this.logger.log(
              `Auto-memory: distilled ${result.count} memories for workspace ${ws.id}`,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `Auto-memory failed for workspace ${ws.id}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Auto-memory distillation sweep failed: ${err.message}`);
    }
  }

  /**
   * Run background curator — reviews skills usage, deactivates unused skills,
   * suggests updates for frequently used skills, and seeds missing starter skills.
   * Called periodically (default: every 1 hour).
   */
  private async runBackgroundCurator(): Promise<void> {
    try {
      this.logger.log('Running background skill curator...');

      // 1. Get all active skills with usage stats
      const skills = await this.skillService.findActive();
      this.logger.log(`Curator: reviewing ${skills.length} active skills`);

      // 2. Deactivate skills with zero usage for 30+ days (use createdAt as proxy for age)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let deactivated = 0;
      for (const skill of skills) {
        if (skill.usageCount === 0 && skill.createdAt < thirtyDaysAgo) {
          await this.skillService.updateSkill(skill.id, { active: false });
          deactivated++;
        }
      }
      if (deactivated > 0) {
        this.logger.log(`Curator: deactivated ${deactivated} unused skills`);
      }

      // 3. Boost priority/pinned for high-usage skills
      let boosted = 0;
      for (const skill of skills) {
        if (skill.usageCount >= 50 && !skill.pinned) {
          await this.skillService.updateSkill(skill.id, { pinned: true });
          boosted++;
        }
      }
      if (boosted > 0) {
        this.logger.log(`Curator: boosted ${boosted} high-usage skills to pinned`);
      }

      // 4. Seed missing starter skills for each active domain
      const domains = [...new Set(skills.map((s) => s.domain).filter(Boolean))];
      for (const domain of domains) {
        try {
          const count = await this.skillService.seedStarterSkills(domain, []);
          if (count > 0) {
            this.logger.log(`Curator: seeded ${count} starter skills for domain ${domain}`);
          }
        } catch (err: any) {
          this.logger.warn(`Curator: failed to seed domain ${domain}: ${err.message}`);
        }
      }

      this.logger.log('Background curator completed');
    } catch (err: any) {
      this.logger.error(`Background curator failed: ${err.message}`);
    }
  }

  /**
   * Run memory consolidation — merge similar/duplicate memories via LLM.
   * Called periodically (default: every 6 hours).
   */
  private async runMemoryConsolidation(): Promise<void> {
    try {
      this.logger.log('Running memory consolidation...');

      // Get all active workspaces
      const workspaces = await this.prisma.workspace.findMany({
        where: { status: 'ready' },
        select: { id: true, businessType: true },
      });

      if (workspaces.length === 0) {
        return;
      }

      this.logger.log(`Memory consolidation: processing ${workspaces.length} workspaces...`);

      for (const ws of workspaces) {
        try {
          const result = await this.autoMemoryService.mergeSimilarMemories(
            ws.id,
            ws.businessType || 'generic',
          );
          if (result.merged > 0) {
            this.logger.log(
              `Memory consolidation: ${result.merged} merged, ${result.removed} removed for workspace ${ws.id}`,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `Memory consolidation failed for workspace ${ws.id}: ${err.message}`,
          );
        }
      }

      this.logger.log('Memory consolidation completed');
    } catch (err: any) {
      this.logger.error(`Memory consolidation sweep failed: ${err.message}`);
    }
  }

  /**
   * Generate report artifact using DocumentGeneratorTool and save to workspace.
   */
  private async executeReportGeneration(job: any) {
    this.logger.log(
      `Executing scheduled report "${job.name}" (${job.reportType}) for workspace ${job.workspaceId}...`,
    );

    let toolResult: any;
    const title = `${job.name} - ${new Date().toISOString().split('T')[0]}`;

    if (job.reportType === 'rug') {
      toolResult = await this.documentGenerator.generateRugReport({
        companyName: title,
        period: 'Bulanan / Otomatis',
        revenue: [{ category: 'Penjualan / Pendapatan', amount: 150000000 }],
        cogs: [{ category: 'Bahan Baku / HPP', amount: 75000000 }],
        operatingExpenses: [
          { category: 'Gaji & Operasional', amount: 25000000 },
          { category: 'Sewa & Listrik', amount: 10000000 },
        ],
      });
    } else if (job.reportType === 'neraca') {
      toolResult = await this.documentGenerator.generateNeracaReport({
        companyName: title,
        period: 'Per Tanggal Ini',
        assets: [
          { category: 'Kas & Bank', amount: 85000000 },
          { category: 'Stok Persediaan', amount: 60000000 },
        ],
        liabilities: [
          { category: 'Hutang Dagang / Supplier', amount: 20000000 },
        ],
        equity: [{ category: 'Modal Pemilik', amount: 125000000 }],
      });
    } else {
      // Default: Laba Rugi
      toolResult = await this.documentGenerator.generateLabaRugiReport({
        companyName: title,
        period: 'Otomatis',
        incomeItems: [{ category: 'Pendapatan Usaha', amount: 120000000 }],
        expenseItems: [
          { category: 'Biaya Bahan Baku', amount: 60000000 },
          { category: 'Biaya Operasional', amount: 20000000 },
        ],
      });
    }

    // Save artifact to database workspace
    const artifact = await this.artifactService.create({
      workspaceId: job.workspaceId,
      name: `${job.name} (.xlsx)`,
      type: 'spreadsheet',
      format: job.format || 'excel',
      path: toolResult?.data?.filePath || `laporan-${job.id}.xlsx`,
      metadata: {
        scheduledJobId: job.id,
        summary: toolResult?.markdownTable || 'Laporan Otomatis Tergenerate',
      },
    });

    // Update lastRunAt and calculate next run (24 hours later)
    await this.prisma.scheduledReport.update({
      where: { id: job.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(
      `Scheduled report "${job.name}" generated successfully! Artifact ID: ${artifact.id}`,
    );
    return artifact;
  }

/**
   * Execute scheduled agent run for a workspace.
   * Uses WorkspaceRunnerService to run agent with a goal.
   */
  private async executeAgentRun(job: any) {
    this.logger.log(
      `Executing scheduled agent run "${job.name}" for workspace ${job.workspaceId}...`,
    );

    const goal = job.goal || 'No goal specified';

    await this.workspaceRunner.runWorkspaceAgentStream(
      {
        workspaceId: job.workspaceId,
        userGoal: goal,
        historyMessages: [],
      },
      () => {}, // scheduled runs are headless; events are discarded
    );

    // Update lastRunAt and nextRunAt
    await this.prisma.scheduledReport.update({
      where: { id: job.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }
}
