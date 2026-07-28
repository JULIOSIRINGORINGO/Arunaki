import { Injectable } from '@nestjs/common';

export interface SessionAdmissionLease {
  release(): Promise<void>;
  run<T>(fn: () => Promise<T>): Promise<T>;
}

interface AdmissionState {
  sessionKey: string;
  status: 'waiting' | 'active' | 'released';
  currentLease: SessionAdmissionLease | null;
  queue: Array<{
    resolve: (lease: SessionAdmissionLease) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
    abortController: AbortController;
    signal?: AbortSignal;
  }>;
}

@Injectable()
export class SessionAdmissionService {
  private readonly state = new Map<string, AdmissionState>();
  private readonly DEFAULT_TIMEOUT_MS = 15000;

  /**
   * Acquire a session admission lease. If another request is already running
   * for this session, queue this request until the current one completes.
   */
  async acquireAdmission(sessionKey: string, signal?: AbortSignal): Promise<SessionAdmissionLease> {
    let state = this.state.get(sessionKey);

    if (!state) {
      // No active admission - grant immediately
      state = this.createInitialState(sessionKey);
      this.state.set(sessionKey, state);
      return state.currentLease!;
    }

    // There's an active admission - queue this request
    return new Promise<SessionAdmissionLease>((resolve, reject) => {
      const abortController = new AbortController();

      const timeoutId = setTimeout(() => {
        // Remove from queue
        state.queue = state.queue.filter(q => q.resolve !== resolve);
        reject(new Error(`Admission timeout for session ${sessionKey} after ${this.DEFAULT_TIMEOUT_MS}ms`));
      }, this.DEFAULT_TIMEOUT_MS);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          state.queue = state.queue.filter(q => q.resolve !== resolve);
          reject(new Error(`Admission aborted for session ${sessionKey}`));
        });
      }

      state.queue.push({ resolve, reject, timeoutId, abortController, signal });
    });
  }

  private createInitialState(sessionKey: string): AdmissionState {
    const state: AdmissionState = {
      sessionKey,
      status: 'active',
      currentLease: null,
      queue: [],
    };

    state.currentLease = this.createLease(state);
    return state;
  }

  private createLease(state: AdmissionState): SessionAdmissionLease {
    return {
      release: async () => {
        state.status = 'released';
        this.state.delete(state.sessionKey);

        // Process next in queue
        if (state.queue.length > 0) {
          const next = state.queue.shift()!;
          clearTimeout(next.timeoutId);
          next.signal?.removeEventListener?.('abort', () => {}); // Best effort cleanup
          const newLease = this.createLease(state);
          state.currentLease = newLease;
          state.status = 'active';
          next.resolve(newLease);
        }
      },
      run: async <T>(fn: () => Promise<T>): Promise<T> => {
        if (state.status !== 'active') {
          throw new Error('Lease is not active');
        }
        try {
          return await fn();
        } finally {
          // Don't auto-release - let caller call release()
        }
      },
    };
  }

  /**
   * Release admission for a session. Call this when the request completes.
   */
  async releaseAdmission(sessionKey: string): Promise<void> {
    const state = this.state.get(sessionKey);
    if (state && state.currentLease) {
      await state.currentLease.release();
    }
  }

  /**
   * Check if a session has an active admission
   */
  hasActiveAdmission(sessionKey: string): boolean {
    const state = this.state.get(sessionKey);
    return state?.status === 'active' || state?.status === 'waiting';
  }

  /**
   * Get current admission status for debugging
   */
  getAdmissionStatus(sessionKey: string): { active: boolean; waiting: boolean } | null {
    const state = this.state.get(sessionKey);
    if (!state) return null;
    return {
      active: state.status === 'active',
      waiting: state.status === 'waiting',
    };
  }
}