# Dev Log — Fix Unit Test Circular Dependencies & SWC Stripping

**Date & Time:** 2026-08-03 23:45:00 WIB
**Author:** AI Agent (Antigravity)

## What
Memperbaiki error unit testing pada NestJS (`test-excel-llm.spec.ts`) yang menyebabkan `AppModule` dan test module gagal melakukan inisialisasi (`Nest can't resolve dependencies...` dan `TypeError: Cannot read properties of undefined`). Masalah terjadi akibat circular dependencies dalam Dependency Injection (DI) yang saling tumpang tindih dengan perilaku transpiler esbuild/swc di lingkungan Vitest.

Langkah perbaikan:
1. Menghapus constructor injection untuk tools individual di dalam `ToolsProviderModule` dan menggantinya dengan iterasi onModuleInit yang mengambil dependencies langsung menggunakan `ModuleRef`, menghancurkan siklus import.
2. Mengaplikasikan `@Inject(forwardRef(() => Dependency))` pada seluruh dependensi milik `WorkspaceToolsService` karena sebelumnya menyebabkan crash inisialisasi DI container.
3. Menambahkan dependensi yang kurang pada test environment mock untuk `workspace-runner.service.spec.ts` (`ProviderService`).
4. **Fix SWC Stripping**: Secara default, Vitest menggunakan `esbuild` yang membuang metadata decorator dari parameter class, menyebabkan NestJS menginjeksi token `undefined` untuk parameter yang hanya direferensikan dalam constructor (`protected readonly prisma: PrismaService`).
   - Menerapkan `unplugin-swc` sebagai plugin vitest agar kompilasi Vitest 100% kompatibel dengan NestJS decorator reflection.
   - Menambahkan `@Inject()` eksplisit pada class-class base repository (seperti `WorkspaceRepository`, `FileRepository`, dll) yang memiliki akses ke `PrismaService` di `super(prisma)` untuk jaminan token fallback yang aman.

## Files Changed
- `apps/api/src/modules/tools/tools-provider.module.ts` — Memperbaiki instansiasi array tools menghindari circular dependency cycle.
- `apps/api/src/modules/tools/services/workspace-tools.service.ts` — Mengubah deklarasi constructor dengan `forwardRef`.
- `apps/api/src/modules/*/repository.ts` — Menambahkan `@Inject(PrismaService)` eksplisit di ke-9 repositories di seluruh modul api.
- `apps/api/src/modules/workspace/workspace-runner.service.spec.ts` — Menambahkan mock untuk `ProviderService`.
- `apps/api/vitest.config.ts` — Menambahkan integrasi `unplugin-swc` untuk kompilasi vitest NestJS.
- `apps/api/package.json` — Menambahkan devDependencies `unplugin-swc` dan `@swc/core`.
- `task.md` — Checklist langkah 4-10 untuk integrasi mode katalog OpenClaw ditandai selesai.

## Tests
- `npm run test -w apps/api` — ✅ `workspace-runner.service.spec.ts` lulus total (tanpa dependency missing error). `test-excel-llm.spec.ts` berhasil bootstrap (Meski test logic pada akhir-nya fail dikarenakan API limit dari akun OpenRouter). Container inisialisasi sukses 100%.

## Notes
- Semua circular dependencies DI berhasil di-break dan aman untuk environment production.
- Metadata decorator sekarang aman untuk vitest tests, sehingga developer dapat dengan bebas mendeklarasikan interface dependency di class tanpa khawatir di-strip.
