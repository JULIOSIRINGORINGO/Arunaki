import { Injectable, Logger } from '@nestjs/common';
import { IContextEngine, ContextEngineConfig } from './context-engine.interface.js';

@Injectable()
export class ContextRegistry {
  private readonly logger = new Logger(ContextRegistry.name);
  private readonly engines = new Map<string, IContextEngine>();
  private activeEngine: string = 'legacy';

  register(engine: IContextEngine): void {
    if (this.engines.has(engine.name)) {
      this.logger.warn(
        `Context engine "${engine.name}" already registered, replacing`,
      );
    }
    this.engines.set(engine.name, engine);
    this.logger.log(`Registered context engine: ${engine.name}`);
  }

  get(name?: string): IContextEngine {
    const engineName = name || this.activeEngine;
    const engine = this.engines.get(engineName);
    if (!engine) {
      this.logger.warn(
        `Context engine "${engineName}" not found, falling back to legacy`,
      );
      const fallback = this.engines.get('legacy');
      if (!fallback) {
        throw new Error('No context engines registered');
      }
      return fallback;
    }
    return engine;
  }

  getActive(): IContextEngine {
    return this.get(this.activeEngine);
  }

  setActive(name: string): void {
    if (!this.engines.has(name)) {
      throw new Error(`Context engine "${name}" not registered`);
    }
    this.activeEngine = name;
    this.logger.log(`Active context engine set to: ${name}`);
  }

  list(): ContextEngineConfig[] {
    return Array.from(this.engines.values()).map((engine) => ({
      name: engine.name,
      contextWindow: engine.config.contextWindow,
      threshold: engine.config.threshold,
      enabled: engine.config.enabled,
    }));
  }

  has(name: string): boolean {
    return this.engines.has(name);
  }
}
