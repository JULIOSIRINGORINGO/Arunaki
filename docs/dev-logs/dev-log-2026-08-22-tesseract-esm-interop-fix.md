# Dev Log — Tesseract ESM/CJS Interop & Workspace-Data Path Resolution Fix

**Date & Time:** 2026-08-22 15:10:30 WIB  
**Author:** Antigravity AI Agent

## Root Cause Discovered & Fixed
1. **Tesseract CommonJS Interop in ESM (`TypeError: Tesseract.recognize is not a function`)**:
   - `import('tesseract.js')` in NestJS/TS compiled ESM returned a module namespace object where `recognize` is attached to `.default` or `.default.recognize`. Calling `Tesseract.recognize` on the raw import namespace failed with a runtime TypeError.
   - **Fix**: Wrapped loader with `(tesseractMod.default?.recognize ? tesseractMod.default : tesseractMod)` fallback chain.
2. **Workspace-Data Path Directory Search**:
   - Depending on whether the process was spawned from the root repository or `apps/api/`, `process.cwd()` varied.
   - **Fix**: Added comprehensive candidate search paths checking `workspace-data`, `apps/api/workspace-data`, and parent directory paths.

## Verification
- `node -e` OCR verification with actual uploaded WhatsApp list image `pasted_image_1787385531149.png` → ✅ Extracted all 12 names and shirt sizes in <1.2 seconds.
- `npx vitest run apps/api/src/modules/tools/services/image-ocr.tool.spec.ts` → ✅ 3/3 passed.
- `npm run build -w apps/api` → ✅ Passed with 0 errors.
