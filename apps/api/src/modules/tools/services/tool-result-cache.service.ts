import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { createHash } from 'crypto';

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 1000;

@Injectable()
export class ToolResultCacheService {
  private readonly logger = new Logger(ToolResultCacheService.name);
  private readonly cache = new Map<string, { result: ToolResult; expiresAt: number }>();

  private computeKey(scope: string, toolName: string, args: Record<string, any>): string {
    const argHash = createHash('sha256')
      .update(JSON.stringify(args ?? {}))
      .digest('hex')
      .substring(0, 16);
    return `${scope}:${toolName}:${argHash}`;
  }

  get(scope: string, toolName: string, args: Record<string, any>): ToolResult | undefined {
    const key = this.computeKey(scope, toolName, args);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return undefined;
  }

  set(scope: string, toolName: string, args: Record<string, any>, result: ToolResult): void {
    this.cleanExpired();
    const key = this.computeKey(scope, toolName, args);
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  invalidateScope(scope: string): void {
    const prefix = `${scope}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    if (this.cache.size > CACHE_MAX_ENTRIES) {
      this.cache.clear();
    }
  }
}
