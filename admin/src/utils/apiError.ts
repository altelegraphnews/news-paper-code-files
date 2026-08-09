/**
 * Turning an API rejection into something an editor can act on.
 *
 * The API answers a rejected write with 422 and
 *   { message: 'خطأ في البيانات المدخلة', errors: [{ field, message }] }
 * where `errors` names precisely what was wrong. Screens that showed only
 * `message` gave every rejection the same face, so an editor hitting one had
 * nothing to go on and would change things that were never the problem.
 */

export const FIELD_LABELS: Record<string, string> = {
  title: 'العنوان',
  subtitle: 'العنوان الفرعي',
  slug: 'الرابط',
  content: 'نص المقال',
  excerpt: 'المقتطف',
  category: 'التصنيف',
  subcategory: 'التصنيف الفرعي',
  tags: 'الوسوم',
  author: 'الكاتب',
  status: 'الحالة',
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  'seo.title': 'عنوان SEO',
  'seo.description': 'وصف SEO',
  'seo.keywords': 'الكلمة المفتاحية',
}

/** A readable, field-named message for a failed request. Never throws. */
export function saveErrorMessage(err: any, fallback = 'فشل في الحفظ'): string {
  const data = err?.response?.data
  const details: any[] = Array.isArray(data?.errors) ? data.errors : []

  if (details.length) {
    const lines = details
      .map((e) => {
        const key = String(e?.field ?? '')
        // Mongoose reports array members as `tags.0`; the label is on the root.
        const label = FIELD_LABELS[key] || FIELD_LABELS[key.split('.')[0]] || key
        const message = e?.message ? String(e.message) : ''
        if (!label) return message
        return message ? `${label}: ${message}` : label
      })
      .filter(Boolean)
    if (lines.length) return lines.join(' — ')
  }

  return data?.message || fallback
}
