import { Injectable, Logger } from '@nestjs/common';
import { Tool, ToolDefinition } from '../interfaces/tool.interface.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { BrowserInteractionService } from '../../interaction/browser-interaction.service.js';

/**
 * BrowserInteractionTool — general browser harness, LLM-driven.
 * Works on any website: navigate, click, type, read content, screenshot.
 * The LLM decides the steps; nothing is hardcoded per-site.
 */
@Injectable()
export class BrowserInteractionTool implements Tool {
  private readonly logger = new Logger(BrowserInteractionTool.name);

  constructor(private readonly browserService: BrowserInteractionService) {}

  get name(): string {
    return 'browser_interaction';
  }

  get displayName(): string {
    return 'Browser Interaction';
  }

  get capability() {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      tags: ['browser', 'web', 'navigate', 'click', 'js', 'render'],
      inputSchema: {
        action: 'browser action to perform',
        url: 'URL to navigate to (for action=navigate)',
        selector: 'CSS selector or visible text (for click/type)',
        text: 'Text to type (for action=type)',
        key: 'Keyboard key to press (for action=pressKey)',
        sessionId: 'Optional session id (default: default)',
      },
      outputType: 'text' as const,
      estimatedLatency: 'medium' as const,
    };
  }

  get description(): string {
    return 'Controls a real browser step by step. Use for pages that need JS interaction (clicking buttons, opening modals/drawers, expanding tables). Actions: navigate, click, type, pressKey, getContent, getHtml, screenshot, goBack, goForward, closeSession. The browser session persists between calls — navigate once, then click/read repeatedly.';
  }

  get definition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'navigate',
                'click',
                'type',
                'pressKey',
                'getContent',
                'getHtml',
                'screenshot',
                'goBack',
                'goForward',
                'closeSession',
              ],
              description:
                'Action to perform. navigate opens a URL, click clicks an element (CSS selector or visible text like "Pesanan Grosir"), type fills an input, getContent reads visible text, getHtml reads raw HTML.',
            },
            url: {
              type: 'string',
              description: 'URL to navigate to (action=navigate).',
            },
            selector: {
              type: 'string',
              description:
                'CSS selector or visible text to click/type into, e.g. "button:text(Pesanan Grosir)" or "div.cursor-pointer".',
            },
            text: {
              type: 'string',
              description: 'Text to type (action=type).',
            },
            key: {
              type: 'string',
              description:
                'Keyboard key name (action=pressKey), e.g. "Enter", "Escape", "Tab".',
            },
            sessionId: {
              type: 'string',
              description:
                'Session id to reuse the same browser tab (default: "default").',
            },
          },
          required: ['action'],
        },
      },
    };
  }

  get isMutating(): boolean {
    return false;
  }

  get timeoutMs(): number {
    return 60000;
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const action = String(args.action || '');
    const sessionId = String(args.sessionId || 'default');

    if (!action) {
      return this.error(
        'INVALID_ARGS',
        'Parameter `action` is required.',
        startTime,
      );
    }

    try {
      switch (action) {
        case 'navigate': {
          const url = String(args.url || '');
          if (!url)
            return this.error(
              'INVALID_ARGS',
              'Parameter `url` is required for navigate.',
              startTime,
            );
          const result = await this.browserService.navigate(url, sessionId);
          const content = await this.browserService.getContent(sessionId);
          return this.success(
            {
              title: result.title,
              url: result.url,
              contentPreview: content.slice(0, 4000),
            },
            `Navigated to "${result.title}" (${result.url}).`,
            startTime,
          );
        }

        case 'click': {
          const selector = String(args.selector || '');
          if (!selector)
            return this.error(
              'INVALID_ARGS',
              'Parameter `selector` is required for click.',
              startTime,
            );
          await this.browserService.click(selector, sessionId);
          return this.success(
            {},
            `Clicked "${selector}". Use getContent to see the result.`,
            startTime,
          );
        }

        case 'type': {
          const selector = String(args.selector || '');
          const text = String(args.text ?? '');
          if (!selector)
            return this.error(
              'INVALID_ARGS',
              'Parameter `selector` is required for type.',
              startTime,
            );
          await this.browserService.type(selector, text, sessionId);
          return this.success(
            {},
            `Typed "${text}" into "${selector}".`,
            startTime,
          );
        }

        case 'pressKey': {
          const key = String(args.key || '');
          if (!key)
            return this.error(
              'INVALID_ARGS',
              'Parameter `key` is required for pressKey.',
              startTime,
            );
          await this.browserService.pressKey(key, sessionId);
          return this.success({}, `Pressed "${key}".`, startTime);
        }

        case 'getContent': {
          const content = await this.browserService.getContent(sessionId);
          return this.success(
            { content },
            content.slice(0, 4000) || `Page content (${content.length} chars).`,
            startTime,
          );
        }

        case 'getHtml': {
          const html = await this.browserService.getHtml(sessionId);
          return this.success(
            { html: html.slice(0, 20000) },
            `Page HTML (${html.length} chars, preview 20k).`,
            startTime,
          );
        }

        case 'screenshot': {
          const base64 = await this.browserService.screenshot(sessionId);
          return this.success(
            { screenshotBase64: base64 },
            'Screenshot captured (base64).',
            startTime,
          );
        }

        case 'goBack':
          await this.browserService.goBack(sessionId);
          return this.success({}, 'Navigated back.', startTime);

        case 'goForward':
          await this.browserService.goForward(sessionId);
          return this.success({}, 'Navigated forward.', startTime);

        case 'closeSession':
          await this.browserService.closeSession(sessionId);
          return this.success(
            {},
            `Browser session "${sessionId}" closed.`,
            startTime,
          );

        default:
          return this.error(
            'INVALID_ACTION',
            `Unknown action "${action}".`,
            startTime,
          );
      }
    } catch (err: any) {
      this.logger.error(
        `[BrowserInteraction] ${action} failed: ${err.message}`,
      );
      return this.error('BROWSER_ACTION_FAILED', err.message, startTime);
    }
  }

  private success(
    data: Record<string, any>,
    preview: string,
    startTime: number,
  ): ToolResult {
    return {
      status: 'success',
      data,
      preview,
      metadata: {
        toolName: this.name,
        displayName: this.displayName,
        executionTime: Date.now() - startTime,
      },
    };
  }

  private error(code: string, message: string, startTime: number): ToolResult {
    return {
      status: 'error',
      data: {},
      preview: message,
      metadata: {
        toolName: this.name,
        displayName: this.displayName,
        executionTime: Date.now() - startTime,
      },
      error: { code, message },
    };
  }
}
