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

  return `Current Date & Time: ${dateStr} (${isoDate}), ${timeStr} WIB`;
}
