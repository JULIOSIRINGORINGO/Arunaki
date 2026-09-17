# Dev Log — Engine Cold Start Speed Optimization

**Date & Time:** 2026-09-17 11:38:00 WIB  
**Author:** Antigravity AI  

## What
Investigated and resolved slow engine cold start behavior:
1. **Identified Bottleneck**: In packages/engine/engine/src/cli/cmd/serve.ts, ServeCommand was previously configured with instance: true. Because the engine is invoked from repo root E:\JS\Arunika by scripts/dev-app.cjs, setting instance: true caused effectCmd to execute InstanceStore.load({ directory: process.cwd() }) synchronously before starting the HTTP server.
2. **Root Cause Analysis**: Eagerly loading the entire E:\JS\Arunika monorepo on startup forced git status checks (Vcs), full filesystem snapshotting (Snapshot), plugin detection (Plugin), and memory sentinel initialization across tens of thousands of files in 
ode_modules and the monorepo. On Windows cold disk cache, this caused engine cold start to take 30–50+ seconds.
3. **The Fix**: Changed instance: false in ServeCommand. The Arunaki HTTP server is designed to load project instances on-demand per request via InstanceContextMiddleware using the x-arunaki-directory header or directory query parameter. The server itself does not require an ambient project instance at launch.
4. **Performance Result**:
   - Engine startup time dropped from ~30–50s on cold start down to **~2.7 seconds** (over 10x faster startup).
   - All core endpoints verified healthy: GET /api/health, GET /api/provider, GET /api/model, GET /api/agent, and POST /api/session.

## Files Changed
- packages/engine/engine/src/cli/cmd/serve.ts — Switched instance: true to instance: false so that the headless server starts up immediately without eagerly scanning and snapshotting the repository directory.

## Tests
- Startup time benchmark via Bun: cold start completed and healthy in 2.73s.
- GET /api/health: 200 OK ({healthy:true})
- GET /api/provider: 200 OK
- GET /api/model: 200 OK
- GET /api/agent: 200 OK
- POST /api/session: 200 OK (session created successfully with on-demand instance loading)
- 
pm run build -w apps/web: ✅ Passed with 0 errors (built in 26.30s)

## Notes
- No architectural boundaries or repository patterns violated.
- Project folder isolation remains fully preserved via InstanceContextMiddleware.
