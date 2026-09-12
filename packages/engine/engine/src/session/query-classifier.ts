import type { SessionV1 } from "@arunaki/core/v1/session"

/**
 * Checks whether a user message represents a casual greeting, chit-chat,
 * small talk, or open-ended conversational query that should NOT trigger any tools.
 *
 * When this returns true:
 * - SessionPrompt provides empty tools ({}) to the model.
 * - SessionPrompt sets toolChoice: "none".
 * - This guarantees deterministic zero-tools execution for greetings like "halo",
 *   preventing aggressive LLMs from scanning files or executing tools prematurely.
 */
export function isCasualGreetingOrChat(userMsg: SessionV1.WithParts | undefined, step: number): boolean {
  // Only evaluate on step 1 (the initial user prompt turn).
  // Once step > 1, the agent is already in an execution loop.
  if (step > 1) return false
  if (!userMsg || userMsg.info.role !== "user") return false

  // 1. If the message includes file attachments, images, or subtasks, it is NOT casual.
  const hasAttachments = userMsg.parts.some(
    (p) => p.type === "file" || p.type === "subtask" || p.type === "patch",
  )
  if (hasAttachments) return false

  // 2. Extract text parts that are NOT synthetic (i.e. directly written by the user)
  const textParts = userMsg.parts.filter(
    (p): p is SessionV1.TextPart => p.type === "text" && !p.synthetic,
  )
  const fullText = textParts.map((p) => p.text).join(" ").trim()
  if (!fullText) return true

  // 3. Multi-line checks: If user pasted 3+ non-empty lines, it's likely raw data/notes.
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 3) return false

  // 4. Tabular data / TSV / Markdown tables:
  if (fullText.includes("\t") || (fullText.includes("|") && lines.length >= 2)) {
    return false
  }

  // 5. Numerical / Financial / Transaction data checks:
  // If user included prices, quantities, currency notations, it's likely transaction data to record.
  if (
    /\b(rp|idr|\$|€|£)\s*\d+/i.test(fullText) ||
    /\b\d+\s*(rb|ribu|k|jt|juta|pcs|sak|dus|kg|lusin|meter|liter|lembar|porsi|unit)\b/i.test(fullText)
  ) {
    return false
  }

  // 6. Strong document, file, or workspace action keywords:
  // If any of these are present, the user is requesting document operations.
  const DOCUMENT_ACTION_REGEX =
    /\b(file|files|dokumen|document|documents|folder|direktori|directory|rekap|rekapan|rekapitulasi|excel|xlsx|xls|word|docx|doc|powerpoint|pptx|ppt|pdf|csv|sheet|sheets|spreadsheet|tabel|table|kolom|column|baris|row|invoice|kwitansi|kuitansi|nota|struk|laporan|report|database|baca|read|open|buka|edit|ubah|tulis|write|create|buat|buatkan|update|simpan|save|hapus|delete|hitung|calculate|total|saldo|jumlah|kas|uang|rupiah|rp|cari|search|find|grep|list|scan|periksa|cek)\b/i
  if (DOCUMENT_ACTION_REGEX.test(fullText)) {
    return false
  }

  // 7. File extension detection (.xlsx, .docx, .txt, .pdf, .json, etc.)
  if (/\.[a-z0-9]{2,5}\b/i.test(fullText)) {
    return false
  }

  // 8. Positive matches for greetings, chit-chat, and conversational messages:
  // Matches Indonesian & English standard greetings and variations
  const GREETING_EXACT_REGEX =
    /^(halo|hai|hi|hey|helo|hello|p|tes|test|testing|ping|assalamualaikum|assalamu[' ]?alaikum|mikum|selamat (pagi|siang|sore|malam|datang|hari ini)|good (morning|afternoon|evening|day)|greetings?)[\s!.,?~-]*$/i
  if (GREETING_EXACT_REGEX.test(fullText)) {
    return true
  }

  // Conversational prefix + name/identity (e.g. "halo arunaki", "hai bot", "selamat pagi arunaki")
  const CONVERSATIONAL_PREFIX_REGEX =
    /^(halo|hai|hi|hey|hello|selamat (pagi|siang|sore|malam))[\s,]+(arunaki|ai|bot|assistant|teman|kawan|bro|sis|mas|mbak|pak|bu)[\s!.,?~-]*$/i
  if (CONVERSATIONAL_PREFIX_REGEX.test(fullText)) {
    return true
  }

  // Small talk, identity questions, gratitude, status checks:
  const SMALL_TALK_REGEX =
    /^(apa kabar|how are you|kamu siapa|siapa kamu|who are you|apa itu arunaki|what is arunaki|kamu bisa apa|bisa apa kamu|apa kemampuanmu|what can you do|perkenalkan dirimu|introduce yourself|help|bantuan|tolong bantu|terima kasih|makasih|makasi|thanks|thank you|ok|oke|okee|sip|siap|mantap|keren|good job|nice|ok terima kasih|ceritakan (lelucon|joke|humor|dongeng|cerita)|tell me a (joke|story)|buatkan kata[- ]kata motivasi|quotes? hari ini|lagi apa|kamu sedang apa)[\s!.,?~-]*$/i
  if (SMALL_TALK_REGEX.test(fullText)) {
    return true
  }

  // Short casual pleasantries (e.g. "pagi!", "siang", "halo semuanya")
  const SHORT_PLEASANTRY_REGEX =
    /^(pagi|siang|sore|malam|halo (semuanya|semua|kawan))[\s!.,?~-]*$/i
  if (SHORT_PLEASANTRY_REGEX.test(fullText)) {
    return true
  }

  // Fallback: If the text is short (< 30 chars) and does NOT contain any verb or document noun
  if (fullText.length <= 25 && !/[0-9]/.test(fullText)) {
    // Check if it's just conversational punctuation or short banter
    const BANTER_REGEX = /^(iya|ya|tidak|gak|nggak|bukan|yep|nope|sure|tentu|boleh|lanjut|halo+|hai+)[\s!.,?~-]*$/i
    if (BANTER_REGEX.test(fullText)) {
      return true
    }
  }

  return false
}
