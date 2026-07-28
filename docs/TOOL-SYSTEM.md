# Tool System — OpenClaw vs Arunaki

## Executive Summary

OpenClaw's tool system is **hook-based with lifecycle management** — tools have `beforeExecute`, `afterExecute`, `onError` hooks, execution modes (parallel/sequential/gated), and validation pipelines. Arunaki's is **registry + executor** — tools register, get validated, execute, return result. Simple but functional.

---

## OpenClaw Tool System

### Architecture: Hook-Based Registry

```
┌─────────────────────────────────────────────────┐
│  ToolRegistry                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tools: Map<string, ToolEntry>              │ │
│  │    ToolEntry:                               │ │
│  │      definition: ToolDefinition             │ │
│  │      hooks: {                               │ │
│  │        beforeExecute: (args) => args        │ │
│  │        afterExecute: (result) => result     │ │
│  │        onError: (error) => recovery         │ │
│  │      }                                      │ │
│  │      validation: ValidationRule[]           │ │
│  │      executionMode: 'parallel'|'sequential'|'gated' │
│  │      timeout: number                        │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  execute(toolName, args, context)               │
│    → Validate args                              │
│    → Run beforeExecute hook                     │
│    → Execute tool                               │
│    → Run afterExecute hook                      │
│    → Return result                              │
│                                                 │
│  executeBatch(toolCalls, mode)                  │
│    → Group by execution mode                    │ │
│    → Parallel: Promise.all()                    │ │
│    → Sequential: for-loop                       │ │
│    → Gated: approval required                   │ │
└─────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. Tool Entry with Hooks

```typescript
interface ToolEntry {
  definition: ToolDefinition;
  hooks: {
    // Transform args before execution
    beforeExecute?: (args: Record<string, any>, context: ExecutionContext) => Record<string, any>;

    // Transform result after execution
    afterExecute?: (result: ToolResult, context: ExecutionContext) => ToolResult;

    // Handle errors with recovery
    onError?: (error: Error, context: ExecutionContext) => ToolResult | null;
  };
  validation: ValidationRule[];
  executionMode: 'parallel' | 'sequential' | 'gated';
  timeout: number;
}
```

**Example: File write tool with hooks**
```typescript
{
  definition: { name: 'write_file', ... },
  hooks: {
    beforeExecute: (args) => {
      // Sanitize path, prevent directory traversal
      args.path = sanitizePath(args.path);
      return args;
    },
    afterExecute: (result) => {
      // Log file change for heartbeat
      eventBus.emit('file_changed', { path: args.path, action: 'write' });
      return result;
    },
    onError: (error) => {
      if (error.message.includes('ENOENT')) {
        // Auto-create directory
        fs.mkdirSync(path.dirname(args.path), { recursive: true });
        return null; // Retry
      }
      return null;
    },
  },
  validation: [
    { field: 'path', required: true, type: 'string' },
    { field: 'content', required: true, type: 'string' },
  ],
  executionMode: 'gated', // Requires approval
  timeout: 10000,
}
```

#### 2. Execution Modes

```typescript
// Parallel: All tools execute simultaneously
await registry.executeBatch(toolCalls, 'parallel');

// Sequential: Tools execute one-by-one
await registry.executeBatch(toolCalls, 'sequential');

// Gated: Requires user approval before execution
await registry.executeBatch(toolCalls, 'gated');
// → Emits 'approval_required' event
// → Waits for user response
// → Then executes
```

#### 3. Validation Pipeline

```typescript
interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  enum?: any[];
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null; // Return error message or null
}

// Validation runs BEFORE beforeExecute hook
const errors = registry.validateArgs(args, tool.validation);
if (errors.length > 0) {
  return { status: 'error', errors };
}
```

#### 4. Tool Context

```typescript
interface ExecutionContext {
  workspaceId: string;
  userId: string;
  sessionId: string;
  abortSignal: AbortSignal;
  tokenBudget: TokenBudget;
  metadata: Record<string, any>;
}

// Tools receive context for:
// - Accessing workspace-scoped resources
// - Checking abort signal
// - Reporting token usage
// - Passing data between tools
```

#### 5. Tool Discovery & Filtering

```typescript
// Get tools by capability
const readTools = registry.getToolsByCapability('read');
const writeTools = registry.getToolsByCapability('write');

// Get tools by tag
const businessTools = registry.getToolsByTags(['business', 'report']);

// Get tools for specific model
const toolsForModel = registry.getToolsForModel('gpt-4o');
// → Filters out tools the model can't handle
```

---

## Arunaki Tool System (Current)

### Architecture: Self-Registering Registry

```
┌─────────────────────────────────────────┐
│  ToolRegistryService                     │
│  ┌─────────────────────────────────────┐ │
│  │  tools: Map<string, RegisteredTool> │ │
│  │    RegisteredTool:                  │ │
│  │      tool: Tool                     │ │
│  │      timeoutMs: number              │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  register(tool)                         │  ← Called during OnModuleInit
│  getToolDefinitions()                   │  ← For LLM function calling
│  validateArgs(args, parameters)         │  ← Basic type checking
│  executeTool(name, args)               │  ← With timeout
│  executeParallel(toolCalls)             │  ← Promise.all()
│  executeParallelLimited(toolCalls, max) │  ← Batched Promise.all()
└─────────────────────────────────────────┘
```

### What Each Method Does

#### register(tool)
```typescript
// Called by each tool service during OnModuleInit
register(tool: Tool): void {
  const timeoutMs = tool.timeoutMs ?? 10000;
  this.tools.set(tool.name, { tool, timeoutMs });
}
```

#### validateArgs(args, parameters)
```typescript
// Basic validation: required fields, type checking, enum values
validateArgs(args, parameters): ValidationResult {
  const errors: string[] = [];
  // Check required fields
  // Check types (string, number, array)
  // Check enum values
  return { valid: errors.length === 0, errors };
}
```

#### executeTool(name, args)
```typescript
// Execute with timeout
async executeTool(name, args): Promise<ToolResult> {
  const { tool, timeoutMs } = registered;
  // Validate args
  // Execute with timeout wrapper
  // Return result with execution time
}
```

#### executeParallel(toolCalls)
```typescript
// Execute all tools simultaneously
async executeParallel(toolCalls): Promise<Results> {
  const promises = toolCalls.map(({ name, args }) =>
    this.executeTool(name, args)
  );
  return Promise.all(promises);
}
```

### What's Missing vs OpenClaw

| Feature | OpenClaw | Arunaki | Impact |
|---------|----------|---------|--------|
| Hooks | beforeExecute, afterExecute, onError | None | Can't transform args/results |
| Execution modes | parallel, sequential, gated | parallel + sequential | No approval gate in registry |
| Validation pipeline | Rules + custom validators | Basic type checking | Limited validation |
| Tool context | workspaceId, userId, abortSignal | Passed as args | No abort, no session |
| Discovery | By capability, tag, model | By name only | Can't filter tools |
| Error recovery | onError hook with retry | SelfHealingService (separate) | Recovery is bolted on |
| Event integration | Hooks emit events | Manual event emission | Inconsistent event flow |

### The SelfHealingService Problem

Arunaki has `SelfHealingService` as a **separate service** that wraps tool execution:

```typescript
// self-healing.service.ts
async executeWithHealing(toolName, args): Promise<SelfHealingResult> {
  // 1. Try normal execution
  // 2. On failure: find recovery strategy
  // 3. Try adjusted args
  // 4. Try fallback tool
  // 5. Give up after max retries
}
```

**Problem:** This is NOT integrated into the tool registry. The agent loop doesn't use it:

```typescript
// workspace-runner.service.ts — uses registry directly, NOT SelfHealingService
result = await this.toolRegistryService.executeTool(funcName, enrichedArgs);
```

So `SelfHealingService` exists but is **never called** by the main agent loop.

---

## Target Architecture for Arunaki

### Phase 1: Add Hooks to Tool Registry

```typescript
interface ToolEntry {
  tool: Tool;
  timeoutMs: number;
  hooks: {
    beforeExecute?: (args: Record<string, any>) => Record<string, any>;
    afterExecute?: (result: ToolResult) => ToolResult;
    onError?: (error: Error) => ToolResult | null;
  };
}

// In executeTool:
async executeTool(name, args): Promise<ToolResult> {
  const entry = this.tools.get(name);

  // Run beforeExecute hook
  if (entry.hooks.beforeExecute) {
    args = entry.hooks.beforeExecute(args);
  }

  try {
    const result = await this.executeWithTimeout(...);

    // Run afterExecute hook
    if (entry.hooks.afterExecute) {
      return entry.hooks.afterExecute(result);
    }
    return result;
  } catch (error) {
    // Run onError hook
    if (entry.hooks.onError) {
      const recovery = entry.hooks.onError(error);
      if (recovery) return recovery;
    }
    throw error;
  }
}
```

### Phase 2: Integrate SelfHealing into Registry

```typescript
// Instead of separate SelfHealingService, integrate into registry
async executeTool(name, args): Promise<ToolResult> {
  const firstResult = await this.executeWithTimeout(name, args);

  if (firstResult.status === 'error') {
    // Try self-healing
    const healingResult = await this.selfHeal(name, args, firstResult);
    if (healingResult.status === 'success') return healingResult;

    // Run onError hook as last resort
    const entry = this.tools.get(name);
    if (entry?.hooks.onError) {
      const recovery = entry.hooks.onError(new Error(firstResult.error?.message));
      if (recovery) return recovery;
    }
  }

  return firstResult;
}
```

### Phase 3: Add Gated Execution Mode

```typescript
// Add approval gate to registry
async executeTool(name, args, options?: { skipApproval?: boolean }): Promise<ToolResult> {
  const entry = this.tools.get(name);

  if (entry.executionMode === 'gated' && !options?.skipApproval) {
    // Emit approval request
    this.eventEmitter.emit('approval_required', {
      toolName: name,
      args,
      callback: async (approved: boolean) => {
        if (!approved) {
          return { status: 'error', preview: 'User rejected tool execution' };
        }
        return this.executeWithTimeout(name, args);
      },
    });
  }
}
```

### Phase 4: Add Tool Context

```typescript
interface ToolExecutionContext {
  workspaceId: string;
  userId?: string;
  sessionId: string;
  abortSignal?: AbortSignal;
  roundNumber: number;
  totalRounds: number;
}

// Pass context to all tools
async executeTool(name, args, context?: ToolExecutionContext): Promise<ToolResult> {
  // Tools can access context for:
  // - workspaceId (already passed as arg, but cleaner as context)
  // - abortSignal (for cancellation)
  // - roundNumber (for progress tracking)
}
```

---

## Key Insight

**OpenClaw's tool system is "hooks + lifecycle."** Tools are first-class citizens with:
- Pre/post execution hooks for transformation
- Error recovery built into the registry
- Execution modes (parallel/sequential/gated) as a first-class concept
- Tool context for workspace-scoped operations

**Arunaki's tool system is "register + execute."** Tools are simple functions that:
- Get registered with a timeout
- Get validated (basic type checking)
- Execute and return results
- Have no lifecycle hooks
- Have no execution modes in the registry
- Have self-healing as a separate, unused service

**The fix: Add hooks to the registry, integrate self-healing, add gated execution.**
