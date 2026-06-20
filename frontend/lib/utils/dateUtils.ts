import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';

type ArabicLocale = 'ar-IQ' | 'ar-SA' | 'ar-EG' | 'ar';

function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const parsed = parseISO(date);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(date);
  if (isValid(fallback)) return fallback;
  return new Date();
}

/**
 * Format a date in Arabic long form.
 * e.g. "١٥ يناير ٢٠٢٤"
 */
export function formatArabicDate(
  date: string | Date,
  locale: ArabicLocale = 'ar-IQ'
): string {
  try {
    const d = parseDate(date);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Format a date with time in Arabic.
 * e.g. "١٥ يناير ٢٠٢٤، ٠٨:٣٠ ص"
 */
export function formatArabicDateTime(
  date: string | Date,
  locale: ArabicLocale = 'ar-IQ'
): string {
  try {
    const d = parseDate(date);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Get a relative time string in Arabic.
 * e.g. "منذ ساعتين", "منذ يومين"
 */
export function getRelativeTime(date: string | Date): string {
  try {
    const d = parseDate(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) return 'منذ لحظات';
    if (diffMinutes === 1) return 'منذ دقيقة';
    if (diffMinutes === 2) return 'منذ دقيقتين';
    if (diffMinutes < 10) return `منذ ${toArabicNumerals(diffMinutes)} دقائق`;
    if (diffMinutes < 60) return `منذ ${toArabicNumerals(diffMinutes)} دقيقة`;
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours < 10) return `منذ ${toArabicNumerals(diffHours)} ساعات`;
    if (diffHours < 24) return `منذ ${toArabicNumerals(diffHours)} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays === 2) return 'منذ يومين';
    if (diffDays < 7) return `منذ ${toArabicNumerals(diffDays)} أيام`;
    if (diffWeeks === 1) return 'منذ أسبوع';
    if (diffWeeks === 2) return 'منذ أسبوعين';
    if (diffWeeks < 4) return `منذ ${toArabicNumerals(diffWeeks)} أسابيع`;
    if (diffMonths === 1) return 'منذ شهر';
    if (diffMonths === 2) return 'منذ شهرين';
    if (diffMonths < 12) return `منذ ${toArabicNumerals(diffMonths)} أشهر`;
    if (diffYears === 1) return 'منذ عام';
    if (diffYears === 2) return 'منذ عامين';
    return `منذ ${toArabicNumerals(diffYears)} أعوام`;
  } catch {
    return '';
  }
}

/**
 * Convert Western numerals to Arabic-Indic numerals.
 * e.g. 123 → "١٢٣"
 */
export function toArabicNumerals(num: number | string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d)]);
}

/**
 * Format date using date-fns with Arabic locale fallback.
 */
export function formatDateFns(date: string | Date, pattern = 'dd MMMM yyyy'): string {
  try {
    const d = parseDate(date);
    return format(d, pattern, { locale: ar });
  } catch {
    return '';
  }
}

/**
 * Get ISO string from date for datetime attribute on <time> elements.
 */
export function getISOString(date: string | Date): string {
  try {
    return parseDate(date).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Format reading time in Arabic.
 * e.g. "٥ دقائق للقراءة"
 */
export function formatReadingTime(minutes: number): string {
  if (minutes <= 0) return 'أقل من دقيقة';
  if (minutes === 1) return 'دقيقة للقراءة';
  if (minutes === 2) return 'دقيقتان للقراءة';
  if (minutes < 11) return `${toArabicNumerals(minutes)} دقائق للقراءة`;
  return `${toArabicNumerals(minutes)} دقيقة للقراءة`;
}

/**
 * Simple Hijri date approximation.
 * For production use a dedicated Hijri library.
 */
export function formatHijriDate(date: string | Date): string {
  try {
    const d = parseDate(date);
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}
