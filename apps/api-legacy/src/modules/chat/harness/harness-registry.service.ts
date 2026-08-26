import { Injectable, Logger } from '@nestjs/common';
import { HarnessPlugin } from './harness-plugin.interface.js';

@Injectable()
export class HarnessRegistryService {
  private readonly logger = new Logger(HarnessRegistryService.name);
  private readonly plugins = new Map<string, HarnessPlugin>();

  register(plugin: HarnessPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin ${plugin.name} already registered, overwriting`);
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.log(
      `Harness plugin registered: ${plugin.name} (priority ${plugin.priority})`,
    );
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  getPlugins(): HarnessPlugin[] {
    return [...this.plugins.values()].sort((a, b) => b.priority - a.priority);
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  async onAgentStart(params: {
    chatId: string;
    runId: string;
    userContent: string;
  }): Promise<void> {
    for (const plugin of this.getPlugins()) {
      if (plugin.onAgentStart) {
        try {
          await plugin.onAgentStart(params);
        } catch (err: any) {
          this.logger.warn(
            `Plugin ${plugin.name}.onAgentStart failed: ${err.message}`,
          );
        }
      }
    }
  }

  async onToolStart(params: {
    chatId: string;
    runId: string;
    toolName: string;
    args: Record<string, any>;
  }): Promise<void> {
    for (const plugin of this.getPlugins()) {
      if (plugin.onToolStart) {
        try {
          await plugin.onToolStart(params);
        } catch (err: any) {
          this.logger.warn(
            `Plugin ${plugin.name}.onToolStart failed: ${err.message}`,
          );
        }
      }
    }
  }

  async onToolResult(params: {
    chatId: string;
    runId: string;
    toolName: string;
    args: Record<string, any>;
    result: any;
  }): Promise<void> {
    for (const plugin of this.getPlugins()) {
      if (plugin.onToolResult) {
        try {
          await plugin.onToolResult(params);
        } catch (err: any) {
          this.logger.warn(
            `Plugin ${plugin.name}.onToolResult failed: ${err.message}`,
          );
        }
      }
    }
  }

  async onAgentComplete(params: {
    chatId: string;
    runId: string;
    result: any;
  }): Promise<void> {
    for (const plugin of this.getPlugins()) {
      if (plugin.onAgentComplete) {
        try {
          await plugin.onAgentComplete(params);
        } catch (err: any) {
          this.logger.warn(
            `Plugin ${plugin.name}.onAgentComplete failed: ${err.message}`,
          );
        }
      }
    }
  }

  async onAgentError(params: {
    chatId: string;
    runId: string;
    error: Error;
  }): Promise<void> {
    for (const plugin of this.getPlugins()) {
      if (plugin.onAgentError) {
        try {
          await plugin.onAgentError(params);
        } catch (err: any) {
          this.logger.warn(
            `Plugin ${plugin.name}.onAgentError failed: ${err.message}`,
          );
        }
      }
    }
  }
}
