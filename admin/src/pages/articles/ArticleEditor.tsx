import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesApi } from '../../api/articles'
import { categoriesApi, type Category } from '../../api/categories'
import { mediaApi } from '../../api/media'
import { usersApi } from '../../api/users'
import RichEditor from '../../components/editor/RichEditor'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useAuthStore } from '../../store/authStore'
import { formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Save, Send, Clock, Eye, ChevronDown, ChevronUp,
  Image as ImageIcon, X, AlertCircle, CheckCircle,
  Tag, ClipboardCheck, XCircle,
} from 'lucide-react'

interface ArticleForm {
  title: string
  subtitle: string
  slug: string
  content: string
  categoryId: string
  subcategoryId: string
  authorId: string
  tags: string[]
  status: string
  scheduledAt: string
  isBreaking: boolean
  isFeatured: boolean
  isSponsored: boolean
  commentsEnabled: boolean
  ogImage: {
    url: string
    alt: string
    caption: string
    publicId: string
  }
  seo: {
    title: string
    description: string
    focusKeyword: string
    canonicalUrl: string
  }
  expiresAt: string
  reviewNote: string
}

const EMPTY_FORM: ArticleForm = {
  title: '',
  subtitle: '',
  slug: '',
  content: '',
  categoryId: '',
  subcategoryId: '',
  authorId: '',
  tags: [],
  status: 'draft',
  scheduledAt: '',
  isBreaking: false,
  isFeatured: false,
  isSponsored: false,
  commentsEnabled: true,
  ogImage: { url: '', alt: '', caption: '', publicId: '' },
  seo: { title: '', description: '', focusKeyword: '', canonicalUrl: '' },
  expiresAt: '',
  reviewNote: '',
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' | 'gold' }> = {
  draft:     { label: 'مسودة', variant: 'default' },
  pending:   { label: 'بانتظار المراجعة', variant: 'gold' },
  rejected:  { label: 'أُعيد مع ملاحظات', variant: 'danger' },
  scheduled: { label: 'مجدول', variant: 'info' },
  published: { label: 'منشور', variant: 'success' },
  archived:  { label: 'مؤرشف', variant: 'default' },
}

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^؀-ۿ\w-]/g, '')
    .toLowerCase()
    .slice(0, 200)
}

function SeoScore({ form }: { form: ArticleForm }) {
  const checks = [
    { label: 'العنوان (50-60 حرف)', ok: form.seo.title.length >= 50 && form.seo.title.length <= 60 },
    { label: 'الوصف (120-160 حرف)', ok: form.seo.description.length >= 120 && form.seo.description.length <= 160 },
    { label: 'الكلمة المفتاحية', ok: form.seo.focusKeyword.length > 0 },
    { label: 'صورة مميزة', ok: !!form.ogImage.url },
    { label: 'نص بديل للصورة', ok: !!form.ogImage.alt },
    { label: 'المحتوى (500+ حرف)', ok: form.content.replace(/<[^>]+>/g, '').length >= 500 },
    { label: 'الوسوم', ok: form.tags.length > 0 },
  ]
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-gold-600' : 'text-red-600'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">نقاط SEO</span>
        <span className={clsx('text-lg font-bold', color)}>{score}/100</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
        <div
          className={clsx('h-2 rounded-full transition-all', score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-gold-500' : 'bg-red-500')}
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="space-y-1 mt-3">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-xs">
            {c.ok
              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />}
            <span className={c.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SideSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700">{children}</div>}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gold-500/50'

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const can = useAuthStore((s) => s.can)
  const currentUser = useAuthStore((s) => s.user)

  const canPublish = can('articles.publish')
  const canFeature = can('articles.feature')
  const canAssignAuthor = can('articles.editAll')

  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM)
  const [categories, setCategories] = useState<Category[]>([])
  const [writers, setWriters] = useState<any[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<any[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaTarget, setMediaTarget] = useState<'featured' | 'content'>('featured')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = useCallback((patch: Partial<ArticleForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  // Load article if editing
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    articlesApi.get(id!)
      .then((res) => {
        const a = res.data?.data || res.data
        setForm({
          title: a.title || '',
          subtitle: a.subtitle || '',
          slug: a.slug || '',
          content: a.content || '',
          categoryId: a.category?._id || a.category || '',
          subcategoryId: a.subcategory?._id || a.subcategory || '',
          authorId: a.author?._id || a.author || '',
          tags: a.tags || [],
          status: a.status || 'draft',
          scheduledAt: a.publishAt ? a.publishAt.slice(0, 16) : '',
          isBreaking: a.isBreaking || false,
          isFeatured: a.isFeatured || false,
          isSponsored: a.isSponsored || false,
          commentsEnabled: a.commentsEnabled !== false,
          ogImage: {
            url: a.ogImage?.url || '',
            alt: a.ogImage?.alt || '',
            caption: a.ogImage?.caption || '',
            publicId: a.ogImage?.publicId || '',
          },
          seo: {
            title: a.seo?.title || '',
            description: a.seo?.description || '',
            focusKeyword: a.seo?.keywords?.[0] || '',
            canonicalUrl: a.seo?.canonical || '',
          },
          expiresAt: a.expireAt ? a.expireAt.slice(0, 16) : '',
          reviewNote: a.review?.note || '',
        })
        setSlugEdited(true)
      })
      .catch(() => toast.error('فشل في تحميل المقال'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // Load categories
  useEffect(() => {
    categoriesApi.list().then((res) => {
      const raw: any[] = res.data?.data || []
      setCategories(raw.map((c) => ({ ...c, id: c._id || c.id, parentId: c.parent ?? c.parentId ?? null })))
    }).catch(() => {})
  }, [])

  // Load writers list for author assignment (editors only)
  useEffect(() => {
    if (!canAssignAuthor) return
    usersApi.writers().then((res) => {
      setWriters(res.data?.data || [])
    }).catch(() => {})
  }, [canAssignAuthor])

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugEdited && form.title) {
      set({ slug: slugify(form.title) })
    }
  }, [form.title, slugEdited, set])

  // Auto-save draft every 30s
  useEffect(() => {
    if (isNew || !['draft', 'rejected'].includes(form.status)) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      handleSave(true)
    }, 30000)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // Map UI form → backend payload (field names per Article model)
  const buildPayload = (overrides: Record<string, any> = {}) => ({
    title: form.title,
    subtitle: form.subtitle,
    content: form.content,
    category: form.categoryId || undefined,
    subcategory: form.subcategoryId || null,
    tags: form.tags,
    status: form.status,
    isBreaking: form.isBreaking,
    isFeatured: form.isFeatured,
    isSponsored: form.isSponsored,
    commentsEnabled: form.commentsEnabled,
    ogImage: form.ogImage.url ? form.ogImage : undefined,
    seo: {
      title: form.seo.title || undefined,
      description: form.seo.description || undefined,
      keywords: form.seo.focusKeyword ? [form.seo.focusKeyword] : [],
      canonical: form.seo.canonicalUrl || undefined,
    },
    publishAt: form.scheduledAt || undefined,
    expireAt: form.expiresAt || undefined,
    author: (canAssignAuthor && form.authorId) ? form.authorId : undefined,
    ...overrides,
  })

  const handleSave = async (silent = false): Promise<string | null> => {
    if (!form.title.trim()) {
      if (!silent) toast.error('يرجى إدخال عنوان المقال')
      return null
    }
    setSaving(true)
    try {
      if (isNew) {
        const res = await articlesApi.create(buildPayload())
        const newId = res.data?.data?._id || res.data?.data?.id
        if (!silent) toast.success('تم حفظ المسودة')
        navigate(`/articles/${newId}/edit`, { replace: true })
        return newId
      } else {
        await articlesApi.update(id!, buildPayload())
        if (!silent) toast.success('تم الحفظ')
        return id!
      }
    } catch (err: any) {
      if (!silent) toast.error(err?.response?.data?.message || 'فشل في الحفظ')
      return null
    } finally {
      setSaving(false)
    }
  }

  // Writer flow: save then submit for editorial review
  const handleSubmitForReview = async () => {
    if (!form.title.trim()) { toast.error('يرجى إدخال عنوان المقال'); return }
    if (!form.content.trim()) { toast.error('يرجى إدخال محتوى المقال'); return }
    if (!form.categoryId) { toast.error('يرجى اختيار تصنيف'); return }
    setSubmitting(true)
    try {
      const articleId = await handleSave(true)
      if (!articleId) throw new Error()
      await articlesApi.submit(articleId)
      toast.success('أُرسل المقال للمراجعة — سيصلك إشعار عند البت فيه')
      set({ status: 'pending' })
      navigate('/articles')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الإرسال للمراجعة')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!form.title.trim()) { toast.error('يرجى إدخال عنوان المقال'); return }
    if (!form.content.trim()) { toast.error('يرجى إدخال محتوى المقال'); return }
    if (!form.categoryId) { toast.error('يرجى اختيار تصنيف'); return }
    setPublishing(true)
    try {
      if (isNew) {
        const res = await articlesApi.create(buildPayload({ status: 'draft' }))
        const newId = res.data?.data?._id || res.data?.data?.id
        await articlesApi.publish(newId)
        toast.success('تم النشر بنجاح')
        navigate('/articles')
      } else {
        await articlesApi.update(id!, buildPayload())
        if (form.status !== 'published') {
          await articlesApi.publish(id!)
        }
        toast.success(form.status === 'published' ? 'تم تحديث المقال المنشور' : 'تم النشر بنجاح')
        set({ status: 'published' })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في النشر')
    } finally {
      setPublishing(false)
    }
  }

  const handleApprove = async () => {
    if (isNew) return
    setPublishing(true)
    try {
      await articlesApi.approve(id!)
      toast.success('تمت الموافقة على المقال ونشره')
      set({ status: 'published' })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الموافقة')
    } finally {
      setPublishing(false)
    }
  }

  const handleReject = async () => {
    if (isNew || rejectNote.trim().length < 3) {
      toast.error('يرجى كتابة سبب الإرجاع للكاتب')
      return
    }
    try {
      await articlesApi.reject(id!, rejectNote.trim())
      toast.success('أُعيد المقال إلى الكاتب')
      set({ status: 'rejected', reviewNote: rejectNote.trim() })
      setShowRejectModal(false)
      setRejectNote('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الإرجاع')
    }
  }

  const handleSchedule = async () => {
    if (!scheduleDate) { toast.error('يرجى تحديد موعد النشر'); return }
    setSaving(true)
    try {
      const payload = buildPayload({ status: 'scheduled', publishAt: scheduleDate })
      if (isNew) {
        const res = await articlesApi.create(payload)
        const newId = res.data?.data?._id || res.data?.data?.id
        toast.success('تم جدولة النشر')
        navigate(`/articles/${newId}/edit`, { replace: true })
      } else {
        await articlesApi.update(id!, payload)
        toast.success('تم جدولة النشر')
        set({ status: 'scheduled', scheduledAt: scheduleDate })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الجدولة')
    } finally {
      setSaving(false)
      setShowScheduleModal(false)
    }
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      set({ tags: [...form.tags, tag] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    set({ tags: form.tags.filter((t) => t !== tag) })
  }

  const openMediaPicker = (target: 'featured' | 'content') => {
    setMediaTarget(target)
    setShowMediaPicker(true)
    if (mediaAssets.length === 0) {
      setMediaLoading(true)
      mediaApi.list().then((res) => {
        setMediaAssets(res.data?.data?.resources || [])
      }).catch(() => {}).finally(() => setMediaLoading(false))
    }
  }

  const selectMedia = (asset: any) => {
    if (mediaTarget === 'featured') {
      set({
        ogImage: {
          url: asset.secure_url || asset.url,
          alt: form.ogImage.alt || form.title,
          caption: form.ogImage.caption || '',
          publicId: asset.public_id,
        },
      })
    }
    setShowMediaPicker(false)
  }

  const parentCategories = categories.filter((c) => !c.parentId)
  const subcategories = categories.filter((c) => c.parentId === form.categoryId)

  // Status options depend on publish rights
  const statusOptions = canPublish
    ? [
        { value: 'draft', label: 'مسودة' },
        { value: 'pending', label: 'بانتظار المراجعة' },
        { value: 'rejected', label: 'أُعيد مع ملاحظات' },
        { value: 'published', label: 'منشور' },
        { value: 'archived', label: 'مؤرشف' },
      ]
    : [
        { value: 'draft', label: 'مسودة' },
        { value: 'pending', label: 'بانتظار المراجعة' },
        ...(form.status === 'rejected' ? [{ value: 'rejected', label: 'أُعيد مع ملاحظات' }] : []),
      ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusMeta = STATUS_META[form.status] ?? STATUS_META.draft

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-surface/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/articles')}
            className="text-sm text-gray-500 hover:text-gold-700 dark:hover:text-gold-300 transition-colors"
          >
            ← المقالات
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isNew ? 'مقال جديد' : 'تعديل مقال'}
          </span>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSave()}
            isLoading={saving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            حفظ
          </Button>

          {canPublish ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleModal(true)}
                leftIcon={<Clock className="w-4 h-4" />}
              >
                جدولة
              </Button>
              {form.status === 'pending' && !isNew && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  إرجاع للكاتب
                </Button>
              )}
              {form.status === 'pending' && !isNew ? (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleApprove}
                  isLoading={publishing}
                  leftIcon={<ClipboardCheck className="w-4 h-4" />}
                >
                  موافقة ونشر
                </Button>
              ) : (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handlePublish}
                  isLoading={publishing}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  {form.status === 'published' ? 'تحديث المنشور' : 'نشر'}
                </Button>
              )}
            </>
          ) : (
            ['draft', 'rejected'].includes(form.status) || isNew ? (
              <Button
                variant="gold"
                size="sm"
                onClick={handleSubmitForReview}
                isLoading={submitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                إرسال للمراجعة
              </Button>
            ) : form.status === 'pending' ? (
              <span className="text-xs text-gold-700 dark:text-gold-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> قيد المراجعة لدى هيئة التحرير
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Rejection note banner for the writer */}
      {form.status === 'rejected' && form.reviewNote && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">أعاد المحرر هذا المقال مع الملاحظات التالية:</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{form.reviewNote}</p>
              <p className="text-xs text-red-500 dark:text-red-500 mt-2">عدّل المقال ثم أرسله للمراجعة مرة أخرى.</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main editor area */}
        <div className="space-y-4">
          {/* Title */}
          <div className="card p-5 space-y-3">
            <textarea
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="عنوان المقال..."
              rows={2}
              className="w-full font-heading text-2xl font-bold text-gray-900 dark:text-gray-100 bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none resize-none"
              dir="rtl"
            />
            <input
              value={form.subtitle}
              onChange={(e) => set({ subtitle: e.target.value })}
              placeholder="العنوان الفرعي (اختياري)..."
              className="w-full text-base text-gray-600 dark:text-gray-400 bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none"
              dir="rtl"
            />
            {/* Slug */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400 flex-shrink-0">الرابط:</span>
              <input
                value={form.slug}
                onChange={(e) => { set({ slug: e.target.value }); setSlugEdited(true) }}
                className="flex-1 text-xs text-gray-500 dark:text-gray-400 bg-transparent border-b border-dashed border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gold-400 pb-0.5"
                dir="ltr"
                placeholder="article-slug"
              />
              <button
                type="button"
                onClick={() => { set({ slug: slugify(form.title) }); setSlugEdited(false) }}
                className="text-xs text-gold-700 dark:text-gold-400 hover:underline flex-shrink-0"
              >
                إعادة توليد
              </button>
            </div>
          </div>

          {/* Featured image */}
          <div className="card overflow-hidden">
            {form.ogImage.url ? (
              <div className="relative">
                <img
                  src={form.ogImage.url}
                  alt={form.ogImage.alt}
                  className="w-full h-56 object-cover"
                />
                <div className="absolute top-2 left-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openMediaPicker('featured')}
                    className="px-2 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80 transition-colors"
                  >
                    تغيير
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ ogImage: EMPTY_FORM.ogImage })}
                    className="p-1 bg-black/60 text-white rounded hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <input
                    value={form.ogImage.alt}
                    onChange={(e) => set({ ogImage: { ...form.ogImage, alt: e.target.value } })}
                    placeholder="النص البديل للصورة..."
                    className="w-full text-sm bg-transparent border-b border-gray-100 dark:border-gray-700 focus:outline-none focus:border-gold-400 pb-1 text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                  <input
                    value={form.ogImage.caption}
                    onChange={(e) => set({ ogImage: { ...form.ogImage, caption: e.target.value } })}
                    placeholder="تعليق على الصورة (اختياري)..."
                    className="w-full text-sm bg-transparent border-b border-gray-100 dark:border-gray-700 focus:outline-none focus:border-gold-400 pb-1 text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openMediaPicker('featured')}
                className="w-full h-40 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:bg-gold-50/50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <ImageIcon className="w-8 h-8" />
                <span className="text-sm font-medium">اختر الصورة المميزة</span>
              </button>
            )}
          </div>

          {/* Content editor */}
          <RichEditor
            value={form.content}
            onChange={(html) => set({ content: html })}
            placeholder="ابدأ كتابة المقال هنا..."
            onImageInsert={() => openMediaPicker('content')}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish settings */}
          <SideSection title="النشر">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => set({ status: e.target.value })}
                className={inputClass}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {!canPublish && (
                <p className="text-xs text-gray-400 mt-1">يتولى المحررون نشر المقال بعد مراجعته.</p>
              )}
            </div>

            {form.scheduledAt && (
              <div className="text-xs text-gold-700 dark:text-gold-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                مجدول: {formatDate(form.scheduledAt)}
              </div>
            )}

            {canFeature && (
              <div className="space-y-2">
                {[
                  { key: 'isBreaking', label: 'خبر عاجل', desc: 'يظهر في شريط الأخبار' },
                  { key: 'isFeatured', label: 'مقال مميز', desc: 'يظهر في قسم المميزات' },
                  { key: 'isSponsored', label: 'محتوى مدفوع', desc: 'يضاف تسمية sponsored' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form[key as keyof ArticleForm] as boolean}
                      onChange={(e) => set({ [key]: e.target.checked } as any)}
                      className="rounded border-gray-300 accent-[#b8923d]"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                      {desc && <span className="block text-xs text-gray-400">{desc}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.commentsEnabled}
                onChange={(e) => set({ commentsEnabled: e.target.checked })}
                className="rounded border-gray-300 accent-[#b8923d]"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">السماح بالتعليقات</span>
            </label>

            {canPublish && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">انتهاء الصلاحية</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => set({ expiresAt: e.target.value })}
                  className={inputClass}
                  dir="ltr"
                />
              </div>
            )}
          </SideSection>

          {/* Author byline (editors only) */}
          {canAssignAuthor && (
            <SideSection title="الكاتب (التوقيع)">
              <select
                value={form.authorId}
                onChange={(e) => set({ authorId: e.target.value })}
                className={inputClass}
              >
                <option value="">{isNew ? `أنا (${currentUser?.name ?? ''})` : 'بدون تغيير'}</option>
                {writers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}{w.jobTitle ? ` — ${w.jobTitle}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">ينشر المقال باسم الكاتب المحدد ويظهر في صفحته.</p>
            </SideSection>
          )}

          {/* Category */}
          <SideSection title="التصنيف">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">التصنيف الرئيسي</label>
              <select
                value={form.categoryId}
                onChange={(e) => set({ categoryId: e.target.value, subcategoryId: '' })}
                className={inputClass}
              >
                <option value="">اختر تصنيفاً...</option>
                {parentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            {subcategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">التصنيف الفرعي</label>
                <select
                  value={form.subcategoryId}
                  onChange={(e) => set({ subcategoryId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">بدون تصنيف فرعي</option>
                  {subcategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
          </SideSection>

          {/* Tags */}
          <SideSection title="الوسوم">
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="أضف وسماً..."
                className={clsx(inputClass, 'flex-1')}
                dir="rtl"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-ink-900 text-gold-300 text-sm rounded-md hover:bg-ink-700 transition-colors"
              >
                +
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gold-50 dark:bg-gold-900/20 text-gold-800 dark:text-gold-300 rounded-sm text-xs font-medium border border-gold-200/60 dark:border-gold-800">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </SideSection>

          {/* SEO */}
          <SideSection title="تحسين محركات البحث (SEO)" defaultOpen={false}>
            <SeoScore form={form} />
            <div className="space-y-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  عنوان SEO
                  <span className={clsx('mr-1', form.seo.title.length > 60 ? 'text-red-500' : 'text-gray-400')}>
                    ({form.seo.title.length}/60)
                  </span>
                </label>
                <input
                  value={form.seo.title}
                  onChange={(e) => set({ seo: { ...form.seo, title: e.target.value } })}
                  placeholder={form.title}
                  className={inputClass}
                  maxLength={70}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  وصف SEO
                  <span className={clsx('mr-1', form.seo.description.length > 160 ? 'text-red-500' : 'text-gray-400')}>
                    ({form.seo.description.length}/160)
                  </span>
                </label>
                <textarea
                  value={form.seo.description}
                  onChange={(e) => set({ seo: { ...form.seo, description: e.target.value } })}
                  rows={3}
                  className={clsx(inputClass, 'resize-none')}
                  maxLength={160}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">الكلمة المفتاحية</label>
                <input
                  value={form.seo.focusKeyword}
                  onChange={(e) => set({ seo: { ...form.seo, focusKeyword: e.target.value } })}
                  placeholder="الكلمة المفتاحية الرئيسية"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">الرابط الكنسي</label>
                <input
                  value={form.seo.canonicalUrl}
                  onChange={(e) => set({ seo: { ...form.seo, canonicalUrl: e.target.value } })}
                  placeholder="https://..."
                  className={inputClass}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Social preview */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> معاينة نتيجة البحث
              </p>
              <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-800 space-y-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 line-clamp-1">
                  {form.seo.title || form.title || 'عنوان المقال'}
                </p>
                <p className="text-xs text-green-700 dark:text-green-500">
                  altilgraf.com/article/{form.slug || 'article-slug'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {form.seo.description || 'الوصف التعريفي للمقال...'}
                </p>
              </div>
            </div>
          </SideSection>
        </div>
      </div>

      {/* Schedule modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="جدولة النشر"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              موعد النشر
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={inputClass}
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="gold" onClick={handleSchedule} isLoading={saving} className="flex-1">
              تأكيد الجدولة
            </Button>
            <Button variant="ghost" onClick={() => setShowScheduleModal(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="إرجاع المقال للكاتب"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              ملاحظات للكاتب (إلزامي)
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              placeholder="اشرح للكاتب ما الذي يحتاج إلى تعديل..."
              className={clsx(inputClass, 'resize-none')}
              dir="rtl"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="danger" onClick={handleReject} className="flex-1">
              إرجاع المقال
            </Button>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* Media picker modal */}
      <Modal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        title="مكتبة الوسائط"
        size="lg"
      >
        <div>
          {mediaLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : mediaAssets.length === 0 ? (
            <div className="text-center py-10 text-gray-400">لا توجد صور في المكتبة</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {mediaAssets.map((asset) => (
                <button
                  key={asset.public_id}
                  type="button"
                  onClick={() => selectMedia(asset)}
                  className="aspect-square rounded-md overflow-hidden border-2 border-transparent hover:border-gold-500 transition-colors focus:outline-none focus:border-gold-500"
                >
                  <img
                    src={asset.secure_url || asset.url}
                    alt={asset.public_id}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
