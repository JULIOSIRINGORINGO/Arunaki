import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface AdmissionLease {
  release(): Promise<void>;
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export interface AdmissionOptions {
  sessionKey: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface AdmissionState {
  queue: Array<{
    resolve: (lease: AdmissionLease) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    timeoutHandle?: NodeJS.Timeout;
  }>;
  active: boolean;
  lease?: AdmissionLease;
}

@Injectable()
export class SessionAdmissionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionAdmissionService.name);
  private readonly states = new Map<string, AdmissionState>();
  private readonly DEFAULT_TIMEOUT_MS = 15_000;

  async beginAdmission(options: AdmissionOptions): Promise<AdmissionLease> {
    const { sessionKey, signal, timeoutMs = this.DEFAULT_TIMEOUT_MS } = options;
    
    const state = this.getOrCreateState(sessionKey);
    
    // If no active lease and queue is empty, grant immediately
    if (!state.active && state.queue.length === 0) {
      this.logger.debug(`Session ${sessionKey}: immediate admission granted`);
      return this.grantAdmission(sessionKey);
    }

    // Otherwise, queue the request
    this.logger.debug(`Session ${sessionKey}: queued (position ${state.queue.length + 1})`);
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const index = state.queue.findIndex(q => q.resolve === resolve);
        if (index !== -1) {
          state.queue.splice(index, 1);
          reject(new Error(`Admission timeout for session ${sessionKey} after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutHandle);
          const index = state.queue.findIndex(q => q.resolve === resolve);
          if (index !== -1) {
            state.queue.splice(index, 1);
            reject(new Error(`Admission aborted for session ${sessionKey}`));
          }
        });
      }

      state.queue.push({ resolve, reject, signal, timeoutHandle });
    });
  }

  private grantAdmission(sessionKey: string): AdmissionLease {
    const state = this.getOrCreateState(sessionKey);
    
    let released = false;
    
    const lease: AdmissionLease = {
      release: async () => {
        if (released) return;
        released = true;
        
        this.logger.debug(`Session ${sessionKey}: lease released`);
        
        state.active = false;
        state.lease = undefined;
        
        // Process next in queue
        if (state.queue.length > 0) {
          const next = state.queue.shift()!;
          clearTimeout(next.timeoutHandle);
          const nextLease = this.grantAdmission(sessionKey);
          next.resolve(nextLease);
        }
      },
      run: async <T>(fn: () => Promise<T>): Promise<T> => {
        try {
          return await fn();
        } finally {
          await lease.release();
        }
      },
    };

    state.active = true;
    state.lease = lease;
    
    return lease;
  }

  private getOrCreateState(sessionKey: string): AdmissionState {
    let state = this.states.get(sessionKey);
    if (!state) {
      state = { queue: [], active: false };
      this.states.set(sessionKey, state);
    }
    return state;
  }

  isAdmitted(sessionKey: string): boolean {
    const state = this.states.get(sessionKey);
    return state?.active === true;
  }

  getQueueLength(sessionKey: string): number {
    const state = this.states.get(sessionKey);
    return state?.queue.length ?? 0;
  }

  async onModuleDestroy(): Promise<void> {
    // Reject all queued requests on shutdown
    for (const [sessionKey, state] of this.states.entries()) {
      for (const queued of state.queue) {
        clearTimeout(queued.timeoutHandle);
        queued.reject(new Error('Service shutting down'));
      }
      state.queue = [];
      if (state.lease) {
        await state.lease.release();
      }
    }
    this.states.clear();
    this.logger.log('SessionAdmissionService: all admissions cleared on shutdown');
  }
}