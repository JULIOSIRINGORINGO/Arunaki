export function number(input: number | bigint, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", opts).format(input)
}

export function truncate(str: string, len: number) {
  if (str.length <= len) return str
  if (len <= 1) return str.slice(0, len)
  return str.slice(0, len - 1) + "…"
}

export function truncateMiddle(str: string, len: number) {
  if (str.length <= len) return str
  if (len <= 2) return str.slice(0, len)
  const left = Math.ceil((len - 1) / 2)
  const right = Math.floor((len - 1) / 2)
  return str.slice(0, left) + "…" + str.slice(str.length - right)
}

export function titlecase(input: string) {
  return input
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ")
}

export function sentencecase(input: string) {
  if (!input.length) return input
  return input[0]!.toUpperCase() + input.slice(1)
}

export function lowercase(input: string) {
  return input.toLowerCase()
}

export function duration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export function pluralize(count: number, singular: string, plural = singular + "s") {
  return count === 1 ? singular : plural
}

export function todayTimeOrDateTime(timestamp: number | string | Date) {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  })
}

export const Locale = {
  number,
  truncate,
  truncateMiddle,
  titlecase,
  sentencecase,
  lowercase,
  duration,
  pluralize,
  todayTimeOrDateTime,
}
