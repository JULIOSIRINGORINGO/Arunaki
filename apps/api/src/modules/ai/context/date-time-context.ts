/**
 * Modular System Date & Time Context Provider.
 * Injects local system date/time information into AI workspace & chat contexts.
 */
export function getSystemDateTimeContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const isoDate = now.toISOString().split('T')[0]; // e.g. 2026-08-11
  const day = now.getDate();
  const monthNameUpper = now
    .toLocaleDateString('id-ID', { month: 'long' })
    .toUpperCase();
  const year = now.getFullYear();
  const formattedHeaderDate = `${day} ${monthNameUpper} ${year}`; // e.g. 11 AGUSTUS 2026

  return `SYSTEM DATE & TIME CONTEXT:
- Current Date: ${dateStr} (${isoDate})
- Current Time: ${timeStr} WIB
- Today Header Date Format: ${formattedHeaderDate}
- CRITICAL REPORT RULE: When updating daily sales reports or period files containing a date in the top title line (e.g., "REKAPAN PENJUALAN 20 JULI 2026"), ALWAYS update that title line date to match today's date: "REKAPAN PENJUALAN ${formattedHeaderDate}".`;
}
