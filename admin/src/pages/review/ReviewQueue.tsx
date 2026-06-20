import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { articlesApi } from '../../api/articles'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { timeAgo } from '../../utils/dateUtils'
import toast from 'react-hot-toast'
import {
  ClipboardCheck, CheckCircle2, XCircle, RefreshCw, Clock,
  User, FolderOpen, Timer, ExternalLink,
} from 'lucide-react'

interface PendingArticle {
  _id: string
  title: string
  excerpt?: string
  ogImage?: { url?: string }
  category?: { name?: string }
  author?: { name?: string; avatar?: { url?: string } }
  readingTimeMin?: number
  review?: { submittedAt?: string }
  createdAt: string
  updatedAt: string
}

export default function ReviewQueue() {
  const [articles, setArticles] = useState<PendingArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingArticle | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const load = () => {
    setLoading(true)
    articlesApi.list({ status: 'pending', limit: 50, sort: '-createdAt' } as any)
      .then((res) => setArticles(res.data?.data || []))
      .catch(() => toast.error('فشل في تحميل قائمة المراجعة'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (article: PendingArticle) => {
    setActingId(article._id)
    try {
      await articlesApi.approve(article._id)
      setArticles((prev) => prev.filter((a) => a._id !== article._id))
      toast.success(`نُشر «${article.title.slice(0, 40)}»`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الموافقة')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (rejectNote.trim().length < 3) {
      toast.error('يرجى كتابة ملاحظات واضحة للكاتب')
      return
    }
    setActingId(rejectTarget._id)
    try {
      await articlesApi.reject(rejectTarget._id, rejectNote.trim())
      setArticles((prev) => prev.filter((a) => a._id !== rejectTarget._id))
      toast.success('أُعيد المقال إلى الكاتب مع الملاحظات')
      setRejectTarget(null)
      setRejectNote('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الإرجاع')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-gold-600" />
            قائمة المراجعة
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {articles.length > 0
              ? `${articles.length} مقال بانتظار قرار هيئة التحرير`
              : 'مقالات الكتّاب المرسلة للمراجعة تظهر هنا'}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-500 hover:text-gold-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="morse-line morse-line--subtle" />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-36 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <CheckCircle2 className="w-12 h-12 text-green-500/60" />
          <p className="font-heading text-lg text-gray-600 dark:text-gray-300">لا توجد مقالات بانتظار المراجعة</p>
          <p className="text-sm">كل شيء تحت السيطرة ✦</p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <div key={article._id} className="card overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {article.ogImage?.url && (
                  <img
                    src={article.ogImage.url}
                    alt=""
                    className="w-full sm:w-44 h-36 sm:h-auto object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 p-4 sm:p-5 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/articles/${article._id}/edit`}
                        className="font-heading text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-gold-700 dark:hover:text-gold-300 transition-colors line-clamp-2"
                      >
                        {article.title}
                      </Link>
                      {article.excerpt && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{article.excerpt}</p>
                      )}
                    </div>
                    <Badge variant="gold" className="flex-shrink-0">
                      <Clock className="w-3 h-3 ml-1" />
                      {timeAgo(article.review?.submittedAt || article.updatedAt)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gold-600" />
                      {article.author?.name ?? 'كاتب'}
                    </span>
                    {article.category?.name && (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {article.category.name}
                      </span>
                    )}
                    {article.readingTimeMin && (
                      <span className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        {article.readingTimeMin} دقائق قراءة
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => handleApprove(article)}
                      isLoading={actingId === article._id}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      موافقة ونشر
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => { setRejectTarget(article); setRejectNote('') }}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      إرجاع مع ملاحظات
                    </Button>
                    <Link
                      to={`/articles/${article._id}/edit`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gold-700 dark:hover:text-gold-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      معاينة وتحرير
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={`إرجاع «${rejectTarget?.title?.slice(0, 40) ?? ''}»`}
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">ملاحظات للكاتب (إلزامي)</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              placeholder="اشرح للكاتب ما الذي يحتاج إلى تعديل قبل النشر..."
              className="input-base text-sm resize-none"
              dir="rtl"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-400">سيرى الكاتب هذه الملاحظات ويمكنه التعديل وإعادة الإرسال.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleReject} isLoading={actingId === rejectTarget?._id} className="flex-1">
              إرجاع المقال
            </Button>
            <Button variant="ghost" onClick={() => setRejectTarget(null)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
