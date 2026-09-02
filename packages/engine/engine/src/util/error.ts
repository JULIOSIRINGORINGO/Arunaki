// Stub for @Arunaki-ai/tui/util/error — local implementation
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  try { return JSON.stringify(e) } catch { return String(e) }
}

export function errorFormat(e: unknown): string {
  return errorMessage(e)
}

export function errorData(e: unknown): Record<string, unknown> | undefined {
  if (e && typeof e === "object" && "data" in e && typeof (e as any).data === "object") {
    return (e as any).data as Record<string, unknown>
  }
  return undefined
}
