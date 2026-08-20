import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CronService } from './cron.service.js';

describe('CronService — Scheduled Reports & Cron Tasks', () => {
  let cronService: CronService;
  let mockPrisma: any;
  let mockArtifactService: any;
  let mockDocumentGenerator: any;
  let mockAutoMemoryService: any;
  let mockSkillService: any;

  beforeEach(() => {
    mockPrisma = {
      scheduledReport: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      workspace: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    mockArtifactService = {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'art_101', name: 'Laporan Laba Rugi.xlsx' }),
    };
    mockDocumentGenerator = {
      generateLabaRugiReport: vi.fn().mockResolvedValue({
        data: { filePath: 'laba-rugi.xlsx' },
        markdownTable: '| Kategori | Jumlah |',
      }),
    };
    mockAutoMemoryService = {
      checkAndDistill: vi
        .fn()
        .mockResolvedValue({ distilled: false, count: 0 }),
      mergeSimilarMemories: vi
        .fn()
        .mockResolvedValue({ merged: 0, removed: 0 }),
    };
    mockSkillService = {
      findActive: vi.fn().mockResolvedValue([]),
      updateSkill: vi.fn(),
      seedStarterSkills: vi.fn().mockResolvedValue(0),
    };

    const mockWorkspaceRunnerService = {
      runAgentInWorkspace: vi.fn(),
    };

    cronService = new CronService(
      mockPrisma,
      mockArtifactService,
      mockDocumentGenerator,
      mockAutoMemoryService,
      mockSkillService,
      mockWorkspaceRunnerService as any,
    );
  });

  it('should create a new scheduled report job', async () => {
    mockPrisma.scheduledReport.create.mockResolvedValue({
      id: 'cron_1',
      workspaceId: 'ws_101',
      name: 'Rekap Omset Mingguan',
      reportType: 'laba_rugi',
      cronExpr: '0 17 * * 5',
      format: 'excel',
      active: true,
      nextRunAt: new Date(),
    });

    const schedule = await cronService.createSchedule({
      workspaceId: 'ws_101',
      name: 'Rekap Omset Mingguan',
      reportType: 'laba_rugi',
      cronExpr: '0 17 * * 5',
      format: 'excel',
    });

    expect(schedule).toBeDefined();
    expect(schedule.name).toBe('Rekap Omset Mingguan');
    expect(mockPrisma.scheduledReport.create).toHaveBeenCalled();
  });

  it('should get all schedules for a workspace', async () => {
    mockPrisma.scheduledReport.findMany.mockResolvedValue([
      { id: 'cron_1', name: 'Laporan 1' },
      { id: 'cron_2', name: 'Laporan 2' },
    ]);

    const schedules = await cronService.getSchedules('ws_101');
    expect(schedules).toHaveLength(2);
  });

  it('should toggle schedule active status', async () => {
    mockPrisma.scheduledReport.findUnique.mockResolvedValue({
      active: true,
      workspaceId: 'ws-1',
    });
    mockPrisma.scheduledReport.update.mockResolvedValue({
      id: 'cron_1',
      active: false,
    });
    const updated = await cronService.toggleSchedule('123', 'ws-1');
    expect(mockPrisma.scheduledReport.update).toHaveBeenCalled();
  });

  it('should delete a schedule', async () => {
    mockPrisma.scheduledReport.findUnique.mockResolvedValue({
      active: true,
      workspaceId: 'ws-1',
    });
    mockPrisma.scheduledReport.delete.mockResolvedValue({ id: 'cron_1' });
    const deleted = await cronService.deleteSchedule('cron_1', 'ws-1');
    expect(deleted.id).toBe('cron_1');
  });
});
