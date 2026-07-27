# Arunaki vs Hermes — Gap Checklist

Status: **4/8 selesai**

---

## 1. Self-evaluation — agent verifikasi hasil kerja sendiri
- [x] Buat `SelfEvaluationService`
- [x] Agent cek artifacts/output setelah task selesai
- [x] Auto-retry jika hasil ga sesuai
- [x] Integrate ke workspace runner

## 2. LLM-based summary — compression pake LLM, bukan template
- [x] Ganti template summary dengan LLM call
- [x] Summary: Goal/Progress/Files/Decisions
- [x] Fallback ke template jika LLM gagal
- [x] Integrate ke ContextManager

## 3. Smart memory recall — prefetch konteks relevan sebelum task
- [x] Auto-search memory berdasarkan user goal
- [x] Inject relevant memories ke system prompt
- [x] Domain-aware recall
- [x] Integrate ke workspace runner

## 4. Skill self-improve — skills auto-update dari experience
- [x] Detect skill usage dalam conversation
- [x] Auto-update skill content jika ada improvement
- [x] Version tracking
- [x] Integrate ke background review

## 5. Model-specific routing — edit format steering per model family
- [ ] Detect model family (Claude/GPT/Gemini)
- [ ] Route edit format berdasarkan model
- [ ] Tool call format adjustment
- [ ] Integrate ke AI service

## 6. Prompt injection detection — scan user input untuk injection
- [ ] Detect injection patterns
- [ ] Block/flag suspicious inputs
- [ ] Log security events
- [ ] Integrate ke chat controller

## 7. Auto-posture detection — detect general vs coding otomatis
- [ ] Analyze user message untuk detect intent
- [ ] Auto-switch prompt posture
- [ ] Confidence scoring
- [ ] Integrate ke AI service

## 8. Template laporan bisnis — RUG, LABA RUGI, NERACA
- [ ] Buat template RUG (Rincian Usaha Gym)
- [ ] Buat template LABA RUGI
- [ ] Buat template NERACA
- [ ] Integrate ke document generator
