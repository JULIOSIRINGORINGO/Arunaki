# OpenClaw Reference — Key Patterns (from source code)

> File ini berisi pola-pola kunci dari OpenClaw source code yang relevan untuk Arunaki.
> Digunakan sebagai reference lokal supaya ga perlu fetch ulang dari GitHub.

---

## 1. Abort Pattern

```typescript
// OpenClaw: agent-command.ts
const lifecycleAbortController = new AbortController();

// Combine multiple abort signals
opts.abortSignal = AbortSignal.any([
  preparedOpts.abortSignal, 
  lifecycleAbortController.signal
]);

// Abort with specific error
lifecycleAbortController.abort(createAgentRunRestartAbortError());

// In the loop, check signal
if (opts.abortSignal.aborted) {
  // Clean exit, save partial results
}
```

**Key difference from Arunaki:** OpenClaw uses `AbortSignal.any()` to combine parent + lifecycle signals. Arunaki uses single AbortController.

**Arunaki adaptation:** Not needed for single-workspace use case. Single controller is sufficient.

---

## 2. Concurrency Control (Session Admission)

```typescript
// OpenClaw: agent-command.ts
sessionWorkAdmission = await beginSessionWorkAdmission({
  scope: storePath ?? `agent:${sessionAgentId}`,
  identities: [sessionKey, sessionId],
  signal: opts.abortSignal,
  onInterrupt: () => lifecycleAbortController.abort(createAgentRunRestartAbortError()),
  assertAllowed: () => {
    // Verify session still valid before starting
    const currentEntry = sessionStoreRuntime.loadSessionEntry({...});
    if (!currentEntry) throw new Error("Session changed");
    sessionEntry = currentEntry;
  },
});

// Run inside admission (queue-based)
await sessionWorkAdmission.run(async () => {
  // Actual work here
});
```

**Key difference from Arunaki:** OpenClaw uses a queue-based admission system. Multiple runs wait in queue instead of being rejected.

**Arunaki adaptation needed:** Simple queue for approval requests. When approval is needed, new requests should wait, not be rejected.

---

## 3. Lifecycle Generation Tracking

```typescript
// OpenClaw: agent-command.ts
let lifecycleGeneration = opts.lifecycleGeneration ?? 
  captureAgentRunLifecycleGeneration(runId);

// Check if still current before major operations
assertAgentRunLifecycleGenerationCurrent(lifecycleGeneration);

// Cleanup on exit
clearAgentRunContext(runId, lifecycleGeneration);
```

**Key difference from Arunaki:** OpenClaw tracks "generations" to detect stale runs. If a new run starts while old one is running, old one is considered stale.

**Arunaki adaptation:** Not needed. Single run per workspace is sufficient.

---

## 4. Crash Recovery

```typescript
// OpenClaw: agent-command.ts
return await runWithAgentCommandRecoveryOwner({
  lifecycleGeneration,
  mode: "reject_uncoordinated",
  opts: { ... },
  prepare: async (preparedOpts) => 
    await prepareAgentCommandExecution(preparedOpts, runtime),
  run: async (prepared) => 
    await agentCommandInternal(prepared, prepared.opts, runtime, resolvedDeps),
});
```

**Key difference from Arunaki:** OpenClaw has restart recovery — if crash, can resume from last checkpoint.

**Arunaki adaptation:** Not needed for web app MVP. User can refresh and restart.

---

## 5. LLM Streaming

```typescript
// OpenClaw: llm/stream.ts
export function stream<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: ProviderStreamOptions,
): AssistantMessageEventStreamContract {
  return deferUntilTransportRuntimeHost(model, () =>
    resolveRuntime(model).stream(model, context, options),
  );
}

// Lazy initialization
function deferUntilTransportRuntimeHost(
  model: Model,
  start: () => AssistantMessageEventStreamContract,
): AssistantMessageEventStreamContract {
  const output = createAssistantMessageEventStream();
  void (async () => {
    try {
      await ensureTransportRuntimeHost();
      for await (const event of start()) {
        output.push(event);
      }
    } catch (error) {
      output.push({ type: "error", reason: "error", error: message });
    } finally {
      output.end();
    }
  })();
  return output;
}
```

**Key difference from Arunaki:** OpenClaw uses event stream pattern with lazy initialization. Arunaki uses direct fetch with SSE.

**Arunaki adaptation:** Our SSE approach is simpler and appropriate for web UI.

---

## 6. Tool Execution (from earlier analysis)

```typescript
// OpenClaw: agent-loop.ts (from audit)
// Dual-loop: outer (steering) + inner (tool calls)
async function runLoop() {
  while (!abortSignal.aborted) {
    // Inner loop: tool calls
    while (true) {
      const response = await streamAssistantResponse(messages);
      if (response.toolCalls.length === 0) break;
      await executeToolCalls(response.toolCalls);
    }
    
    // Check for steering input
    const steering = steeringQueue.get(sessionId);
    if (steering) {
      messages.push({ role: 'user', content: steering.message });
      continue; // Re-enter inner loop
    }
    break; // No steering, exit
  }
}
```

**Key difference from Arunaki:** OpenClaw has dual-loop with steering. Arunaki has single loop with pause/resume for approval.

**Arunaki adaptation:** Our approval gate with `pausedRuns` is a valid alternative to steering for business use case.

---

## Summary: What Arunaki Phase 1 Has vs OpenClaw

| Feature | OpenClaw | Arunaki Phase 1 | Status |
|---------|----------|-----------------|--------|
| Abort | AbortSignal.any() | Single AbortController | ✅ Sufficient |
| Concurrency | Queue-based admission | Queue-based approval (waitForApproval/resolveApproval) | ✅ Done |
| Lifecycle | Generation tracking | State machine (AgentState) | ✅ Sufficient |
| Recovery | Crash recovery | None | ✅ Not needed for MVP |
| Persistence | SQLite | In-memory (activeRuns, approvalQueue) | ✅ Sufficient for MVP |
| Approval | Steering queue | Queue-based approval via Promise | ✅ Cleaner than OpenClaw |
| Tool execution | Parallel + sequential | Parallel + sequential + self-healing | ✅ Better |
| LLM streaming | Event stream | SSE | ✅ Appropriate for web |
