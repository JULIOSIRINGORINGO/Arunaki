import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common';
import { WebSocketServer, WebSocket, RawData } from 'ws';

export const DESKTOP_BRIDGE_PORT = 'DESKTOP_BRIDGE_PORT';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

@Injectable()
export class DesktopBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DesktopBridgeService.name);
  private wss: WebSocketServer | null = null;
  private desktop: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private nextId = 0;

  constructor(
    @Optional() @Inject(DESKTOP_BRIDGE_PORT) private readonly port: number = 31524,
  ) {}

  get isConnected(): boolean {
    return this.desktop !== null && this.desktop.readyState === WebSocket.OPEN;
  }

  onModuleInit() {
    this.startServer();
  }

  onModuleDestroy() {
    this.stopServer();
  }

  private startServer() {
    try {
      this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });
      this.wss.on('connection', (ws: WebSocket, req: any) => {
        // Validate token
        const expectedKey = process.env.ARUNAKI_API_KEY;
        const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const token = url.searchParams.get('token');
        
        if (!expectedKey || token !== expectedKey) {
          this.logger.warn('Unauthorized desktop connection attempt');
          ws.close(1008, 'Unauthorized');
          return;
        }

        const previous = this.desktop;
        this.desktop = ws;
        if (previous && previous !== ws && previous.readyState === WebSocket.OPEN) {
          this.logger.warn('Desktop reconnected; closing stale socket');
          previous.close();
        }
        this.logger.log('Desktop app connected');

        ws.on('message', (raw: RawData) => {
          try {
            const msg = JSON.parse(raw.toString());
            this.handleMessage(msg);
          } catch {
            this.logger.warn(`Invalid message from desktop: ${raw.toString().slice(0, 200)}`);
          }
        });

        ws.on('close', () => {
          if (this.desktop === ws) {
            this.logger.warn('Desktop app disconnected');
            this.desktop = null;
            this.rejectAllPending(new Error('Desktop disconnected'));
          } else {
            this.logger.warn('Stale desktop socket closed');
          }
        });

        ws.on('error', (err: Error) => {
          this.logger.error(`Desktop WebSocket error: ${err.message}`);
        });
      });

      this.wss.on('error', (err: Error) => {
        this.logger.error(`Desktop WebSocket server error: ${err.message}`);
      });

      this.logger.log(`Desktop bridge listening on ws://127.0.0.1:${this.port}`);
    } catch (err) {
      this.logger.error(`Failed to start desktop bridge: ${err.message}`);
    }
  }

  private stopServer() {
    this.rejectAllPending(new Error('Server shutting down'));
    if (this.desktop) {
      try { this.desktop.close(); } catch { /* ignore */ }
      this.desktop = null;
    }
    if (this.wss) {
      try { this.wss.close(); } catch { /* ignore */ }
      this.wss = null;
    }
  }

  private handleMessage(msg: any) {
    if (msg.type === 'result' && msg.id) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.data ?? {});
        }
      }
    }
  }

  sendCommand(method: string, args: Record<string, any> = {}, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Desktop app is not connected. Run the Arunaki desktop app.'));
        return;
      }

      const id = `dsk_${++this.nextId}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Desktop command "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.desktop!.send(JSON.stringify({ type: 'call', id, method, args }), (err?: Error | undefined) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`Send failed: ${err.message}`));
        }
      });
    });
  }

  excelWriteCell(path: string | undefined, cell: string, value: any): Promise<any> {
    return this.sendCommand('excelWriteCell', { path, cell, value });
  }

  excelSetFormat(path: string | undefined, range: string, formatOptions: Record<string, any>): Promise<any> {
    return this.sendCommand('excelSetFormat', { path, range, ...formatOptions });
  }

  excelEdit(path: string | undefined, actions: Array<Record<string, any>>): Promise<any> {
    return this.sendCommand('excelEdit', { path, actions }, 30000);
  }

  wordType(
    text: string,
    addNewline = false,
    smoothStream = false,
    delayMs = 25,
  ): Promise<any> {
    return this.sendCommand('wordType', { text, addNewline, smoothStream, delayMs });
  }

  wordFormat(formatOptions: Record<string, any>): Promise<any> {
    return this.sendCommand('wordFormat', formatOptions);
  }

  sendKeys(keys: string): Promise<any> {
    return this.sendCommand('sendKeys', { keys });
  }

  private rejectAllPending(err: Error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }
}