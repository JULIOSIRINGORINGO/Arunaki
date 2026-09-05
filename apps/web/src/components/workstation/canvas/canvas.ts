export function extractCanvasTitle(content: string): string {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "Tabel Data";
  if (lines[0].startsWith("|")) {
    const cells = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length > 0) {
      return `Tabel: ${cells.slice(0, 2).join(" / ")}`;
    }
    return "Tabel Data";
  }
  const firstLine = lines[0].replace(/^#+\s*/, "").replace(/[`*|]/g, "").trim();
  if (firstLine.length > 0 && firstLine.length <= 36) return firstLine;
  if (firstLine.length > 36) return firstLine.slice(0, 34) + "...";
  return "Data Canvas";
}

export function extractCanvasContent(llmText: string): string {
  if (!llmText) return "";

  // 1. Explicit completed [CANVAS]...[/CANVAS] block
  const completeMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i);
  if (completeMatch?.[1]?.trim() && completeMatch[1].trim().length >= 10) {
    return completeMatch[1].trim();
  }

  // 2. Real-time streaming [CANVAS]... (only when meaningful body has started, at least 15 chars)
  const streamMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*)$/i);
  if (streamMatch?.[1]?.trim() && streamMatch[1].trim().length >= 15) {
    return streamMatch[1].trim();
  }

  // Conversational text, codeblocks, tables, and regular chat answers stay in chat
  return "";
}
