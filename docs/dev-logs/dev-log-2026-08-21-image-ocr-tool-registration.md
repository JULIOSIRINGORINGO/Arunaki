# Dev Log — Image OCR Tool Registration & Offline Image Parser Integration

**Date & Time:** 2026-08-21 20:05:35 WIB  
**Author:** Antigravity AI Agent

## What
Diagnosed why Arunaki previously responded saying it had no OCR capability:

1. **Root Cause**:
   - `ImageOcrTool` and `VisionAiTool` (using `tesseract.js` for offline local OCR) existed in `apps/api/src/modules/tools/services/`, but were **omitted from `HarnessMetaToolsRegistrar.register(...)`**.
   - As a result, the tool definitions `image_ocr` and `vision_ai` were not provided in the LLM's available tool schema.
   - Additionally, `DocumentReaderTool` only handled `.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, returning `Unsupported format: .png` when `read` was invoked on images.
2. **Fixes Implemented**:
   - **`HarnessMetaToolsRegistrar`**: Registered `image_ocr` and `vision_ai` with clear tags (`['image', 'ocr', 'vision', 'extract', 'read', 'photo', 'screenshot']`) and descriptive parameters.
   - **`DocumentReaderTool`**: Added native image format cases (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tiff`, `.tif`) that automatically route image files through offline OCR (`Tesseract.recognize`).
   - **System Prompt (`rules.md`)**: Added Section 14 explicitly instructing the agent to invoke `image_ocr` or `read` whenever an image is uploaded or mentioned, and never claim lack of OCR.
   - **Unit Tests**: Created `image-ocr.tool.spec.ts` verifying path error handling and reader image resolution.

## Files Changed
- `apps/api/src/modules/tools/services/registrars/harness-meta-tools.registrar.ts`
- `apps/api/src/modules/tools/services/document-reader.tool.ts`
- `apps/api/src/prompts/rules.md`
- `apps/api/src/modules/tools/services/image-ocr.tool.spec.ts`

## Verification
- `npx vitest run apps/api/src/modules/tools/services/image-ocr.tool.spec.ts` — ✅ 3/3 passed
- `npm run build -w apps/api` — ✅ Passed
- `npm run build -w apps/web` — ✅ Passed
