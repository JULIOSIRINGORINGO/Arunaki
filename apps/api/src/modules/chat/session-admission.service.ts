import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SessionAdmissionLease {
  release(): Promise<void>;
}

interface QueuedAdmission {
  resolve: (lease: SessionAdmissionLease) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface AdmissionState {
  queue: QueuedAdmission[];
  active: boolean;
}

@Injectable()
export class SessionAdmissionService {
  private readonly state = new Map<string, AdmissionState>();
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const configuredTimeout = Number(config.get<string>('SESSION_ADMISSION_TIMEOUT_MS'));
    this.timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 15000;
  }

  async acquireAdmission(sessionKey: string, signal?: AbortSignal): Promise<SessionAdmissionLease> {
    let state = this.state.get(sessionKey);
    if (!state) {
      state = { active: true, queue: [] };
      this.state.set(sessionKey, state);
      return this.createLease(sessionKey, state);
    }

    return new Promise<SessionAdmissionLease>((resolve, reject) => {
      const queued: QueuedAdmission = {
        resolve,
        reject,
        timeoutId: setTimeout(() => {
          this.removeQueuedAdmission(sessionKey, state!, queued);
          reject(new Error(`Admission timeout for session ${sessionKey} after ${this.timeoutMs}ms`));
        }, this.timeoutMs),
        signal,
      };
      queued.onAbort = () => {
        clearTimeout(queued.timeoutId);
        this.removeQueuedAdmission(sessionKey, state!, queued);
        reject(new Error(`Admission aborted for session ${sessionKey}`));
      };
      if (signal?.aborted) {
        queued.onAbort();
        return;
      }
      signal?.addEventListener('abort', queued.onAbort, { once: true });
      state.queue.push(queued);
    });
  }

  hasActiveAdmission(sessionKey: string): boolean {
    return this.state.has(sessionKey);
  }

  getAdmissionStatus(sessionKey: string): { active: boolean; waiting: boolean } | null {
    const state = this.state.get(sessionKey);
    return state ? { active: state.active, waiting: state.queue.length > 0 } : null;
  }

  private createLease(sessionKey: string, state: AdmissionState): SessionAdmissionLease {
    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        const next = state.queue.shift();
        if (!next) {
          this.state.delete(sessionKey);
          return;
        }
        clearTimeout(next.timeoutId);
        if (next.onAbort) next.signal?.removeEventListener('abort', next.onAbort);
        next.resolve(this.createLease(sessionKey, state));
      },
    };
  }

  private removeQueuedAdmission(
    sessionKey: string,
    state: AdmissionState,
    queued: QueuedAdmission,
  ): void {
    const index = state.queue.indexOf(queued);
    if (index >= 0) state.queue.splice(index, 1);
    if (!state.active && state.queue.length === 0) this.state.delete(sessionKey);
  }
}
