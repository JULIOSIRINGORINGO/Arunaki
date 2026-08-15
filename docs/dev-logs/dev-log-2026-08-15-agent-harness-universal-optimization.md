# Dev Log — Agent Harness & Prompt Engine Universal Multi-Tier Optimization

**Date & Time:** 2026-08-15 23:41:00 WIB  
**Author:** Antigravity  

## What
1. **Universal Tool Call Repair (`tool-call-repair.ts`)**:
   - Upgraded parser to support XML tags (`<function_call>`, `<function:name>`, `<function/name>`), markdown code blocks (````json ... ````, ````tool ... ````), flat JSON objects with top-level parameters, and ReAct style (`Action / Action Input`).
   - Added robust JSON healing for trailing commas, escaped newlines, and alias resolution (`arguments`, `parameters`, `args`, `input`, `action_input`).
2. **Dynamic Model Capabilities (`model-capability.ts`)**:
   - Implemented dynamic heuristics for unknown/novel models across any provider (OpenAI, Anthropic, Gemini, OpenRouter, Kenari, Groq, Ollama).
   - Dynamic reasoning model detection (`deepseek-r`, `qwq`, `reasoner`, `o1`, `o3`) with token headroom scaling and `reasoningEffort: 'low'`.
3. **Model Router Steering (`model-router.service.ts`)**:
   - Added strict JSON tool schema guidelines and formatting rules for open-weights models (GPT-OSS, Qwen, DeepSeek, Llama).
4. **Adaptive Latency & Provider Override Resolution (`ai.service.ts`, `sdk-transformer.util.ts`, `workspace-runner.service.ts`)**:
   - Resolved dynamic model override propagation in `chat` and `chatStream` across all fallback and database provider states.
   - Updated TTFB timeout to 35s to prevent agent hangs on upstream queueing.
   - Cleaned streamed content leaks when tool calls are extracted from text.

## Files Changed
- `apps/api/src/modules/ai/tool-call-repair.ts`
- `apps/api/src/modules/ai/model-capability.ts`
- `apps/api/src/modules/ai/model-router.service.ts`
- `apps/api/src/modules/ai/sdk-transformer.util.ts`
- `apps/api/src/modules/ai/ai.service.ts`
- `apps/api/src/modules/workspace/workspace-runner.service.ts`
- `apps/api/test/tool-call-repair.spec.ts`

## Tests
- `npx vitest run test/tool-call-repair.spec.ts` — ✅ 7/7 tests passed (15ms)
- `node --experimental-strip-types apps/api/scripts/test-rekap-extended.ts gemini-2-5-flash` — ✅ 17/17 autonomous document verification checks passed (29.8s)
- API Health Check `http://127.0.0.1:3000/api/v1/health` — ✅ HTTP 200 OK
