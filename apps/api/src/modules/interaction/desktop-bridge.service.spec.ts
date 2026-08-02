import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DesktopBridgeService } from './desktop-bridge.service.js';
import WebSocket from 'ws';

describe('DesktopBridgeService', () => {
  let service: DesktopBridgeService;
  let port: number;
  let testIndex = 0;

  beforeEach(() => {
    process.env.ARUNAKI_API_KEY = 'test-token-123';
    // Unique port per test avoids collision with a live API holding 31524.
    port = 32524 + testIndex++;
    service = new DesktopBridgeService(port);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should initialize with isConnected = false', () => {
    expect(service.isConnected).toBe(false);
  });

  it('should reject sendCommand when desktop app is not connected', async () => {
    await expect(service.sendCommand('ping')).rejects.toThrow(
      'Desktop app tidak terhubung',
    );
  });

  it('should connect client and handle sendCommand success', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}?token=test-token-123`);

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    expect(service.isConnected).toBe(true);

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'call' && msg.method === 'ping') {
        client.send(
          JSON.stringify({
            type: 'result',
            id: msg.id,
            data: { pong: true },
          }),
        );
      }
    });

    const res = await service.sendCommand('ping');
    expect(res).toEqual({ pong: true });

    client.close();
  });

  it('should handle interactive desktop helper methods', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}?token=test-token-123`);

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'call') {
        client.send(
          JSON.stringify({
            type: 'result',
            id: msg.id,
            data: { success: true, method: msg.method, args: msg.args },
          }),
        );
      }
    });

    const excelRes = await service.excelWriteCell(undefined, 'A1', 'Hello Excel');
    expect(excelRes).toEqual({ success: true, method: 'excelWriteCell', args: { cell: 'A1', value: 'Hello Excel' } });

    const formatRes = await service.excelSetFormat(undefined, 'A1:B1', { bold: true });
    expect(formatRes).toEqual({ success: true, method: 'excelSetFormat', args: { range: 'A1:B1', bold: true } });

    const wordRes = await service.wordType('Paragraph text', true, true, 20);
    expect(wordRes).toEqual({ success: true, method: 'wordType', args: { text: 'Paragraph text', addNewline: true, smoothStream: true, delayMs: 20 } });

    const wordFmtRes = await service.wordFormat({ style: 'Heading 1' });
    expect(wordFmtRes).toEqual({ success: true, method: 'wordFormat', args: { style: 'Heading 1' } });

    const keysRes = await service.sendKeys('^s');
    expect(keysRes).toEqual({ success: true, method: 'sendKeys', args: { keys: '^s' } });

    client.close();
  });

  it('should handle desktop command errors', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}?token=test-token-123`);

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'call') {
        client.send(
          JSON.stringify({
            type: 'result',
            id: msg.id,
            error: 'File not found',
          }),
        );
      }
    });

    await expect(service.sendCommand('openFile', { path: '/invalid' })).rejects.toThrow(
      'File not found',
    );

    client.close();
  });

  it('should reject pending requests if client disconnects', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}?token=test-token-123`);

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    const pendingCmd = service.sendCommand('longTask');
    client.close();

    await expect(pendingCmd).rejects.toThrow('Desktop disconnected');
  });
});
