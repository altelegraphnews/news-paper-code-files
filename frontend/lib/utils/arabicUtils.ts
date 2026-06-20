/**
 * Arabic utility functions for the AL-WID news website.
 */

/**
 * Convert Western Arabic numerals (0-9) to Eastern Arabic-Indic numerals.
 */
export function toEasternArabic(num: number | string): string {
  const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => eastern[parseInt(d)]);
}

/**
 * Convert Eastern Arabic-Indic numerals back to Western numerals.
 */
export function fromEasternArabic(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Transliterate Arabic text to a URL-safe ASCII slug.
 * Falls back to encoding Arabic characters.
 */
export function arabicToSlug(text: string): string {
  const arabicMap: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', 'ب': 'b', 'ت': 't',
    'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
    'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
    'ي': 'y', 'ى': 'a', 'ة': 'h', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
    'لا': 'la', 'لأ': 'la', 'لإ': 'li', 'لآ': 'la',
  };

  return text
    .toLowerCase()
    .replace(/[\u0621-\u064A]/g, (char) => arabicMap[char] || char)
    .replace(/[\u064B-\u065F]/g, '') // Remove tashkeel (diacritics)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Truncate Arabic text to a maximum length, respecting word boundaries.
 */
export function truncateArabic(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + suffix;
  }
  return truncated + suffix;
}

/**
 * Format Arabic number with thousands separator.
 * e.g. 1234567 → "١٬٢٣٤٬٥٦٧"
 */
export function formatArabicNumber(num: number, useEastern = true): string {
  const formatted = new Intl.NumberFormat('ar-IQ').format(num);
  return useEastern ? formatted : formatted.replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  );
}

/**
 * Detect if a string contains Arabic characters.
 */
export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Get text direction based on content.
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  return isArabicText(text) ? 'rtl' : 'ltr';
}

/**
 * Format view count with Arabic labels.
 */
export function formatViewCount(count: number): string {
  if (count < 1000) return toEasternArabic(count) + ' مشاهدة';
  if (count < 1000000) {
    const k = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return toEasternArabic(k) + 'ألف مشاهدة';
  }
  const m = (count / 1000000).toFixed(1).replace(/\.0$/, '');
  return toEasternArabic(m) + ' مليون مشاهدة';
}

/**
 * Convert Arabic category slugs to display names.
 */
export const CATEGORY_NAMES: Record<string, string> = {
  madkhal: 'المدخل',
  shir: 'شعر',
  sard: 'سرد',
  qiraat: 'قراءات',
  fikr: 'فكر',
  hiwar: 'حوار',
  tarjama: 'ترجمة',
  isdaraat: 'إصدارات',
};

/**
 * Pluralize Arabic words based on count (simplified).
 */
export function arabicPlural(
  count: number,
  singular: string,
  dual: string,
  plural: string,
  pluralMany: string
): string {
  if (count === 0) return `لا ${plural}`;
  if (count === 1) return `${singular} واحد`;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return `${toEasternArabic(count)} ${plural}`;
  return `${toEasternArabic(count)} ${pluralMany}`;
}

/**
 * Generate Arabic page title for SEO.
 */
export function generateArabicTitle(parts: string[], siteName = 'التلغراف'): string {
  return [...parts, siteName].filter(Boolean).join(' | ');
}
