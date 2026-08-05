import { describe, it, expect } from 'vitest';
import { ToolLoopDetectorService } from './tool-loop-detector.service.js';

describe('ToolLoopDetectorService (Gap #16)', () => {
  it('triggers circuit breaker after 3 identical calls in one session', () => {
    const svc = new ToolLoopDetectorService();
    const ws = 'ws-1';

    svc.checkAndRecord(ws, 'read_workspace_file', { filePath: 'a.txt' });
    svc.checkAndRecord(ws, 'read_workspace_file', { filePath: 'a.txt' });
    const third = svc.checkAndRecord(ws, 'read_workspace_file', { filePath: 'a.txt' });

    expect(third.isLooping).toBe(true);
    expect(third.repeatCount).toBe(3);
  });

  it('clearSession resets history so the next run does not false-positive', () => {
    const svc = new ToolLoopDetectorService();
    const ws = 'ws-1';

    for (let i = 0; i < 3; i++) {
      svc.checkAndRecord(ws, 'read_workspace_file', { filePath: 'a.txt' });
    }

    svc.clearSession(ws);

    const nextRun = svc.checkAndRecord(ws, 'read_workspace_file', { filePath: 'a.txt' });
    expect(nextRun.isLooping).toBe(false);
    expect(nextRun.repeatCount).toBe(1);
  });

  it('histories of different workspaces are independent', () => {
    const svc = new ToolLoopDetectorService();

    for (let i = 0; i < 3; i++) {
      svc.checkAndRecord('ws-a', 'read_workspace_file', { filePath: 'a.txt' });
      svc.checkAndRecord('ws-b', 'read_workspace_file', { filePath: 'a.txt' });
    }

    const a = svc.checkAndRecord('ws-a', 'read_workspace_file', { filePath: 'a.txt' });
    const b = svc.checkAndRecord('ws-b', 'read_workspace_file', { filePath: 'a.txt' });
    expect(a.isLooping).toBe(true);
    expect(b.isLooping).toBe(true);
  });
});
