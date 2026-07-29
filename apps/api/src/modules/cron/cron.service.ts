import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { DocumentGeneratorTool } from '../tools/services/document-generator.tool.js';
import { AutoMemoryService } from '../memory/auto-memory.service.js';

export interface CreateScheduleDto {
  workspaceId: string;
  name: string;
  reportType: string; // laba_rugi, rug, neraca, stok
  cronExpr?: string; // e.g. "daily", "weekly", "monthly", or standard cron expression
  format?: string; // excel, pdf, csv
}

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);
  private timerHandle: NodeJS.Timeout | null = null;
  private autoMemoryHandle: NodeJS.Timeout | null = null;
  private autoMemoryIntervalMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifactService: ArtifactService,
    private readonly documentGenerator: DocumentGeneratorTool,
    private readonly autoMemoryService: AutoMemoryService,
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
   * Create a new scheduled report job.
   */
  async createSchedule(dto: CreateScheduleDto) {
    return this.prisma.scheduledReport.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        reportType: dto.reportType || 'laba_rugi',
        cronExpr: dto.cronExpr || '0 17 * * *',
        format: dto.format || 'excel',
        active: true,
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next run in 24h
      },
    });
  }

  /**
   * Toggle active status.
   */
  async toggleSchedule(id: string) {
    const existing = await this.prisma.scheduledReport.findUnique({
      where: { id },
    });
    if (!existing) return null;

    return this.prisma.scheduledReport.update({
      where: { id },
      data: { active: !existing.active },
    });
  }

  /**
   * Delete a scheduled report.
   */
  async deleteSchedule(id: string) {
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
      try {
        await this.executeReportGeneration(job);
      } catch (err: any) {
        this.logger.error(
          `Failed to execute scheduled report "${job.name}": ${err.message}`,
        );
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
}
