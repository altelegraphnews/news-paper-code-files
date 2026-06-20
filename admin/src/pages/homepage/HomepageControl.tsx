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

export default function HomepageControl() {
  const [heroArticle, setHeroArticle] = useState<ArticleOption | null>(null)
  const [featuredArticles, setFeaturedArticles] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invalidating, setInvalidating] = useState(false)
  const [heroSearch, setHeroSearch] = useState('')
  const [heroResults, setHeroResults] = useState<ArticleOption[]>([])
  const [heroLoading, setHeroLoading] = useState(false)
  const debouncedHeroSearch = useDebounce(heroSearch, 400)

  useEffect(() => {
    if (!debouncedHeroSearch.trim()) { setHeroResults([]); return }
    setHeroLoading(true)
    articlesApi.list({ search: debouncedHeroSearch, status: 'published', limit: 6 })
      .then((res) => setHeroResults(res.data?.data || []))
      .catch(() => {})
      .finally(() => setHeroLoading(false))
  }, [debouncedHeroSearch])

  const load = useCallback(() => {
    setLoading(true)
    // Load hero and featured from the homepage API
    Promise.allSettled([
      homepageApi.getHero().catch(() => ({ data: { data: null } })),
      homepageApi.getFeatured().catch(() => ({ data: { data: [] } })),
    ]).then(([heroRes, featuredRes]) => {
      if (heroRes.status === 'fulfilled') setHeroArticle((heroRes.value as any).data?.data || null)
      if (featuredRes.status === 'fulfilled') setFeaturedArticles((featuredRes.value as any).data?.data || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSetHero = async (article: ArticleOption) => {
    setSaving(true)
    try {
      await homepageApi.setHero(article._id)
      setHeroArticle(article)
      setHeroSearch('')
      setHeroResults([])
      toast.success('تم تعيين الخبر الرئيسي')
    } catch { toast.error('فشل في تعيين الخبر الرئيسي') }
    finally { setSaving(false) }
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

      {/* Hero Article */}
      <div className="card">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Star className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">الخبر الرئيسي (Hero)</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">يظهر في أعلى الصفحة الرئيسية بشكل بارز</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {heroArticle && (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-md border border-green-100 dark:border-green-800">
              {heroArticle.featuredImage?.url && (
                <img src={heroArticle.featuredImage.url} alt="" className="w-16 h-12 object-cover rounded-md flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{heroArticle.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{heroArticle.category?.name || ''}</p>
              </div>
              <button
                onClick={() => setHeroArticle(null)}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="relative">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder="ابحث عن مقال لتعيينه خبراً رئيسياً..."
                className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
              {heroLoading && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {heroResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-surface dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
                {heroResults.map((article) => (
                  <button
                    key={article._id}
                    type="button"
                    onClick={() => handleSetHero(article)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                  </button>
                ))}
              </div>
            )}
          </div>
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
              selectedIds={[...featuredArticles.map((a) => a._id), heroArticle?._id || '']}
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
