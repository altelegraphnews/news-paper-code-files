import { useEffect, useState, useCallback } from 'react'
import { articlesApi } from '../../api/articles'
import { homepageApi } from '../../api/homepage'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  RefreshCw, GripVertical, Eye, EyeOff, Search,
  RotateCcw, Star, Zap, Layout, CheckCircle, X,
} from 'lucide-react'

interface ArticleOption {
  _id: string
  title: string
  status: string
  category?: { name: string }
  featuredImage?: { url: string }
  publishedAt?: string
}

function ArticleSearch({
  placeholder,
  onSelect,
  selectedIds = [],
}: {
  placeholder: string
  onSelect: (article: ArticleOption) => void
  selectedIds?: string[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return }
    setLoading(true)
    articlesApi.list({ search: debouncedQuery, status: 'published', limit: 8 })
      .then((res) => setResults(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
        />
        {loading && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-surface dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          {results.map((article) => {
            const isSelected = selectedIds.includes(article._id)
            return (
              <button
                key={article._id}
                type="button"
                onClick={() => { onSelect(article); setQuery(''); setResults([]) }}
                disabled={isSelected}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  isSelected && 'opacity-40 cursor-not-allowed'
                )}
              >
                {article.featuredImage?.url ? (
                  <img src={article.featuredImage.url} alt="" className="w-10 h-8 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-10 h-8 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{article.title}</p>
                  <p className="text-xs text-gray-400">{article.category?.name || ''}</p>
                </div>
                {isSelected && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The homepage hero cross-fades through this many articles at most.
const MAX_HERO_SLIDES = 7

export default function HomepageControl() {
  const [heroSlides, setHeroSlides] = useState<ArticleOption[]>([])
  const [featuredArticles, setFeaturedArticles] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invalidating, setInvalidating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    // Load hero slides and featured from the homepage API
    Promise.allSettled([
      homepageApi.getHeroSlides().catch(() => ({ data: { data: [] } })),
      homepageApi.getFeatured().catch(() => ({ data: { data: [] } })),
    ]).then(([heroRes, featuredRes]) => {
      if (heroRes.status === 'fulfilled') setHeroSlides((heroRes.value as any).data?.data || [])
      if (featuredRes.status === 'fulfilled') setFeaturedArticles((featuredRes.value as any).data?.data || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Persist the slide list, rolling the UI back if the save fails.
  const saveHeroSlides = async (list: ArticleOption[], successMsg: string) => {
    const previous = heroSlides
    setHeroSlides(list)
    setSaving(true)
    try {
      await homepageApi.setHeroSlides(list.map((a) => a._id))
      toast.success(successMsg)
    } catch {
      setHeroSlides(previous)
      toast.error('فشل في الحفظ')
    } finally { setSaving(false) }
  }

  const handleAddHeroSlide = (article: ArticleOption) => {
    if (heroSlides.length >= MAX_HERO_SLIDES) {
      toast.error(`الحد الأقصى ${MAX_HERO_SLIDES} مقالات في الواجهة`)
      return
    }
    saveHeroSlides([...heroSlides, article], 'تمت الإضافة إلى الواجهة')
  }

  const handleRemoveHeroSlide = (id: string) =>
    saveHeroSlides(heroSlides.filter((a) => a._id !== id), 'تمت الإزالة من الواجهة')

  const handleMoveHeroSlide = (fromIdx: number, toIdx: number) => {
    const reordered = [...heroSlides]
    const [item] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, item)
    saveHeroSlides(reordered, 'تم إعادة الترتيب')
  }

  const handleAddFeatured = async (article: ArticleOption) => {
    if (featuredArticles.length >= 6) { toast.error('الحد الأقصى 6 مقالات مميزة'); return }
    const newList = [...featuredArticles, article]
    setSaving(true)
    try {
      await homepageApi.setFeatured(newList.map((a) => a._id))
      setFeaturedArticles(newList)
      toast.success('تمت الإضافة')
    } catch { toast.error('فشل في الحفظ') }
    finally { setSaving(false) }
  }

  const handleRemoveFeatured = async (id: string) => {
    const newList = featuredArticles.filter((a) => a._id !== id)
    setSaving(true)
    try {
      await homepageApi.setFeatured(newList.map((a) => a._id))
      setFeaturedArticles(newList)
      toast.success('تمت الإزالة')
    } catch { toast.error('فشل في الحفظ') }
    finally { setSaving(false) }
  }

  const handleMoveFeatured = async (fromIdx: number, toIdx: number) => {
    const reordered = [...featuredArticles]
    const [item] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, item)
    setFeaturedArticles(reordered)
    try {
      await homepageApi.setFeatured(reordered.map((a) => a._id))
    } catch {
      toast.error('فشل في إعادة الترتيب')
      load()
    }
  }

  const handleInvalidateCache = async () => {
    setInvalidating(true)
    try {
      // POST to homepage invalidate endpoint
      await fetch('/api/homepage/invalidate', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      toast.success('تم مسح الكاش — سيتم تحديث الصفحة الرئيسية')
    } catch {
      toast.error('فشل في مسح الكاش')
    } finally {
      setInvalidating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التحكم في الصفحة الرئيسية</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تحكم في الخبر الرئيسي والمقالات المميزة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInvalidateCache}
            isLoading={invalidating}
          >
            <RotateCcw className="w-4 h-4 ml-1" />
            مسح الكاش
          </Button>
        </div>
      </div>

      {/* Hero carousel slides */}
      <div className="card">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Star className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">مقالات الواجهة (Hero)</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {heroSlides.length}/{MAX_HERO_SLIDES} مقالات — تتناوب تلقائياً في أعلى الصفحة الرئيسية بالترتيب أدناه
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {heroSlides.length > 0 && (
            <div className="space-y-2">
              {heroSlides.map((article, idx) => (
                <div
                  key={article._id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-md border',
                    idx === 0
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-800 border-transparent'
                  )}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0">{idx + 1}</span>
                  {article.featuredImage?.url ? (
                    <img src={article.featuredImage.url} alt="" className="w-12 h-9 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-9 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{article.title}</p>
                    <p className="text-xs text-gray-400">
                      {article.category?.name || ''}
                      {idx === 0 && <span className="text-green-600 dark:text-green-400 mr-1">• يظهر أولاً</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => idx > 0 && handleMoveHeroSlide(idx, idx - 1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="تحريك للأعلى"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => idx < heroSlides.length - 1 && handleMoveHeroSlide(idx, idx + 1)}
                      disabled={idx === heroSlides.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="تحريك للأسفل"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveHeroSlide(article._id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {heroSlides.length < MAX_HERO_SLIDES ? (
            <ArticleSearch
              placeholder="ابحث عن مقال لإضافته إلى الواجهة..."
              onSelect={handleAddHeroSlide}
              selectedIds={heroSlides.map((a) => a._id)}
            />
          ) : (
            <p className="text-xs text-center text-gray-400">
              وصلت للحد الأقصى ({MAX_HERO_SLIDES} مقالات). احذف مقالاً لإضافة آخر.
            </p>
          )}

          {heroSlides.length === 1 && (
            <p className="text-xs text-center text-gray-400">
              أضف مقالاً آخر على الأقل لتفعيل التناوب في الواجهة.
            </p>
          )}
        </div>
      </div>

      {/* Featured Articles */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Layout className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">المقالات المميزة</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {featuredArticles.length}/6 مقالات تظهر في قسم المميزات
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Current featured */}
          {featuredArticles.length > 0 && (
            <div className="space-y-2">
              {featuredArticles.map((article, idx) => (
                <div
                  key={article._id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab" />
                  <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0">{idx + 1}</span>
                  {article.featuredImage?.url && (
                    <img src={article.featuredImage.url} alt="" className="w-12 h-9 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{article.title}</p>
                    <p className="text-xs text-gray-400">{article.category?.name || ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => idx > 0 && handleMoveFeatured(idx, idx - 1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="تحريك للأعلى"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => idx < featuredArticles.length - 1 && handleMoveFeatured(idx, idx + 1)}
                      disabled={idx === featuredArticles.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="تحريك للأسفل"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveFeatured(article._id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add featured */}
          {featuredArticles.length < 6 && (
            <ArticleSearch
              placeholder="ابحث عن مقال لإضافته للمميزات..."
              onSelect={handleAddFeatured}
              selectedIds={[...featuredArticles.map((a) => a._id), ...heroSlides.map((a) => a._id)]}
            />
          )}

          {featuredArticles.length >= 6 && (
            <p className="text-xs text-center text-gray-400">وصلت للحد الأقصى (6 مقالات). احذف مقالاً لإضافة آخر.</p>
          )}
        </div>
      </div>

      {/* Cache info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-md border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>ملاحظة:</strong> الصفحة الرئيسية تُخزَّن مؤقتاً لمدة 60 ثانية. بعد أي تغيير، اضغط <strong>مسح الكاش</strong> لتطبيق التغييرات فوراً.
        </p>
      </div>
    </div>
  )
}
