import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TranscriptEngineService } from './transcript-engine.service.js';
import { TimeTravelService } from './time-travel.service.js';

describe('TranscriptEngineService & TimeTravelService', () => {
  let transcriptEngine: TranscriptEngineService;
  let timeTravelService: TimeTravelService;
  let tempDir: string;
  const mockSessionId = 'test-session-123';
  let mockPrisma: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    tempDir = path.join(process.cwd(), 'temp-transcript-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    transcriptEngine = new TranscriptEngineService();
    mockPrisma = {
      workspace: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'test-ws-id',
          rootPath: tempDir,
        }),
      },
    };
    mockEventEmitter = {
      emitRollback: vi.fn(),
    };

    timeTravelService = new TimeTravelService(
      mockPrisma,
      transcriptEngine,
      mockEventEmitter,
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should append events sequentially into transcript.jsonl', async () => {
    const evt1 = await transcriptEngine.appendEvent(
      tempDir,
      mockSessionId,
      'session_start',
      { goal: 'Update reports' },
    );
    expect(evt1.sequence).toBe(1);
    expect(evt1.type).toBe('session_start');

    const evt2 = await transcriptEngine.appendEvent(
      tempDir,
      mockSessionId,
      'user_message',
      { content: 'Hello' },
    );
    expect(evt2.sequence).toBe(2);

    const transcript = await transcriptEngine.getTranscript(
      tempDir,
      mockSessionId,
    );
    expect(transcript).toHaveLength(2);
    expect(transcript[0].type).toBe('session_start');
    expect(transcript[1].type).toBe('user_message');
  });

  it('should capture snapshot and successfully rollback file using TimeTravelService', async () => {
    const testFile = 'REKAPAN.txt';
    const testFilePath = path.join(tempDir, testFile);
    const initialContent = 'REKAPAN PENJUALAN 10 AGUSTUS 2026\nTOTAL = 100RB';

    // 1. Write initial file
    fs.writeFileSync(testFilePath, initialContent, 'utf-8');

    // 2. Capture pre-mutation snapshot event
    const snapshot = transcriptEngine.captureFileSnapshot(tempDir, testFile);
    expect(snapshot).toBe(initialContent);

    const snapEvent = await transcriptEngine.appendEvent(
      tempDir,
      mockSessionId,
      'file_snapshot_pre',
      {
        tool: 'edit',
        filePath: testFile,
        snapshotContent: snapshot,
      },
    );

    // 3. Mutate file (simulating AI agent modifying file)
    const modifiedContent = 'REKAPAN PENJUALAN 17 AGUSTUS 2026\nTOTAL = 999RB';
    fs.writeFileSync(testFilePath, modifiedContent, 'utf-8');
    expect(fs.readFileSync(testFilePath, 'utf-8')).toBe(modifiedContent);

    // 4. Check checkpoints
    const checkpoints = await transcriptEngine.getCheckpoints(
      tempDir,
      mockSessionId,
    );
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].checkpointId).toBe(snapEvent.id);

    // 5. Execute 1-Click Rollback / Undo
    const result = await timeTravelService.rollbackSession(
      'test-ws-id',
      mockSessionId,
    );
    expect(result.success).toBe(true);
    expect(result.restoredCount).toBe(1);

    // 6. Verify file restored to exact original content
    const restoredContent = fs.readFileSync(testFilePath, 'utf-8');
    expect(restoredContent).toBe(initialContent);

    // 7. Verify audit log has rollback_performed event
    const transcriptAfterRollback = await transcriptEngine.getTranscript(
      tempDir,
      mockSessionId,
    );
    const lastEvent =
      transcriptAfterRollback[transcriptAfterRollback.length - 1];
    expect(lastEvent.type).toBe('rollback_performed');
  });
});
