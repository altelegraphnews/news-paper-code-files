import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { ar } from 'date-fns/locale'

/** Format a date string to a localized Arabic display string */
export function formatDate(dateStr: string | Date, fmt = 'dd MMMM yyyy'): string {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    if (!isValid(date)) return '—'
    return format(date, fmt, { locale: ar })
  } catch {
    return '—'
  }
}

/** Format to date + time */
export function formatDateTime(dateStr: string | Date): string {
  return formatDate(dateStr, 'dd MMMM yyyy، HH:mm')
}

/** Relative time (e.g. "منذ 3 ساعات") */
export function timeAgo(dateStr: string | Date): string {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    if (!isValid(date)) return '—'
    return formatDistanceToNow(date, { addSuffix: true, locale: ar })
  } catch {
    return '—'
  }
}

/** Format bytes to readable Arabic string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 بايت'
  const k = 1024
  const sizes = ['بايت', 'ك.ب', 'م.ب', 'ج.ب']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** Convert Date to ISO string for API */
export function toISOString(date: Date | null): string | undefined {
  if (!date) return undefined
  return date.toISOString()
}

/** Format number with Arabic locale */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ar-SA').format(n)
}

/** Short number format (1.2k, 3.5m) */
export function formatNumberShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ألف`
  return formatNumber(n)
}
