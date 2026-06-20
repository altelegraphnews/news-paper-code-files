/** Convert Arabic/Persian numerals to Western */
export function toWesternNumerals(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

/** Generate a URL-safe slug from Arabic text */
export function generateSlug(text: string): string {
  // Transliterate common Arabic letters
  const map: Record<string, string> = {
    'أ': 'a', 'إ': 'i', 'آ': 'a', 'ا': 'a',
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
    'ة': 'h', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
    'ّ': '', 'َ': '',
    'ُ': '', 'ِ': '', 'ً': '', 'ٌ': '', 'ٍ': '',
    'ْ': '', 'ـ': '',
  }

  let slug = text
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) {
    // Fallback: use timestamp
    slug = `article-${Date.now()}`
  }
  return slug
}

/** Calculate estimated reading time in Arabic */
export function readingTime(text: string): string {
  const wordsPerMinute = 200
  const words = text.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / wordsPerMinute))
  if (minutes === 1) return 'دقيقة واحدة للقراءة'
  if (minutes === 2) return 'دقيقتان للقراءة'
  if (minutes <= 10) return `${minutes} دقائق للقراءة`
  return `${minutes} دقيقة للقراءة`
}

/** Count words in text (strips HTML tags) */
export function wordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').length
}

/** Truncate text with ellipsis */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/** Role labels in Arabic */
export const roleLabels: Record<string, string> = {
  admin:     'مدير',
  editor:    'محرر',
  author:    'كاتب',
  moderator: 'مشرف',
}

/** Status labels in Arabic */
export const statusLabels: Record<string, string> = {
  draft:     'مسودة',
  published: 'منشور',
  scheduled: 'مجدول',
  archived:  'مؤرشف',
  pending:   'قيد الانتظار',
  approved:  'موافق عليه',
  rejected:  'مرفوض',
  spam:      'بريد مزعج',
}

/** Status badge colors */
export const statusColors: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  archived:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  pending:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  approved:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  spam:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}
