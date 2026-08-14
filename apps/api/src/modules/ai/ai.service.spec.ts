import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { SystemPromptBuilderService } from './system-prompt-builder.service.js';
import { ModelRouterService } from './model-router.service.js';
import { AutoPostureDetector } from './auto-posture-detector.service.js';
import { ContextManager } from './context-manager.js';

describe('AiService & SystemPromptBuilderService - System Prompt Caching Stability', () => {
  let service: AiService;
  let promptBuilder: SystemPromptBuilderService;
  let mockConfig: any;
  let mockProviderService: any;
  let mockToolRegistryService: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'AI_API_KEY') return 'mock-key';
        if (key === 'AI_MODEL') return 'mock-model';
        return null;
      }),
    };

    mockProviderService = {
      getPrimaryProvider: vi.fn().mockReturnValue(null),
    };

    mockToolRegistryService = {
      getToolCapabilities: vi.fn().mockReturnValue([]),
      getToolDirectoryText: vi.fn().mockReturnValue('Mock Directory Text'),
    };

    const postureDetector = new AutoPostureDetector();
    const modelRouter = new ModelRouterService();
    const contextManager = new ContextManager(
      { contextLength: 32000, threshold: 0.25, targetRatio: 0.2, toolPruneChars: 1000, toolPreviewChars: 250, injectionMaxChars: 2000, useLlmSummary: true },
      { chat: vi.fn() },
    );

    promptBuilder = new SystemPromptBuilderService(
      postureDetector,
      modelRouter,
      mockToolRegistryService as any,
      contextManager,
    );

    service = new AiService(
      mockConfig,
      mockProviderService,
      mockToolRegistryService as any,
      promptBuilder,
    );

    // Mock internal methods that load files to ensure deterministic tests
    vi.spyOn(promptBuilder as any, 'loadPrompt').mockImplementation((filename: string) => {
      return `Mock content for ${filename}`;
    });

    vi.spyOn(promptBuilder as any, 'buildToolListSummary').mockReturnValue('Mock Tool List');
    vi.spyOn(promptBuilder as any, 'buildWorkspaceMemorySection').mockReturnValue('Mock Workspace Memory');
    vi.spyOn(promptBuilder as any, 'buildTemporalContextSection').mockReturnValue('Mock Temporal Context');
  });

  it('should maintain an identical static prefix for workspace mode regardless of dynamic workspaceContext', () => {
    const prompt1 = service.getSystemPrompt('workspace', 'Folder A context', undefined, []);
    const prompt2 = service.getSystemPrompt('workspace', 'Folder B entirely different context', undefined, []);

    // Split by the '---' which is the boundary for dynamic content
    const prefix1 = prompt1.split('---')[0];
    const prefix2 = prompt2.split('---')[0];

    // The static prefix MUST be identical to ensure LLM prompt caching is not invalidated
    expect(prefix1).toBe(prefix2);

    // Ensure the dynamic content actually made it to the end
    expect(prompt1).toContain('Folder A context');
    expect(prompt2).toContain('Folder B entirely different context');
  });

  it('should maintain an identical static prefix for chat mode regardless of dynamic knowledgeContext', () => {
    const prompt1 = service.getSystemPrompt('chat', undefined, 'Knowledge Base Context 1', []);
    const prompt2 = service.getSystemPrompt('chat', undefined, 'Completely Different KB Context 2', []);

    // Split by '## Knowledge Graph Map'
    const prefix1 = prompt1.split('## Knowledge Graph Map')[0];
    const prefix2 = prompt2.split('## Knowledge Graph Map')[0];

    // The static prefix MUST be identical to ensure LLM prompt caching is not invalidated
    expect(prefix1).toBe(prefix2);

    // Ensure the dynamic content actually made it to the end
    expect(prompt1).toContain('Knowledge Base Context 1');
    expect(prompt2).toContain('Completely Different KB Context 2');
  });
});
