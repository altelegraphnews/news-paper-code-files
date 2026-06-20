import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { articlesApi } from '../../api/articles'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatDateTime } from '../../utils/dateUtils'
import { RotateCcw, ChevronRight, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

interface Revision {
  _id: string
  version: number
  title: string
  content: string
  createdAt: string
  author?: { displayName?: string; name?: string }
  changesSummary?: string
}

export default function ArticleRevisions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Revision | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [preview, setPreview] = useState<'left' | 'right'>('left')

  useEffect(() => {
    if (!id) return
    articlesApi.getRevisions(id)
      .then((res) => setRevisions(res.data?.data || []))
      .catch(() => toast.error('فشل في تحميل المراجعات'))
      .finally(() => setLoading(false))
  }, [id])

  const handleRestore = async () => {
    if (!id || !restoreTarget) return
    setRestoring(true)
    try {
      await articlesApi.restoreRevision(id, restoreTarget)
      toast.success('تم استعادة المراجعة بنجاح')
      navigate(`/articles/${id}/edit`)
    } catch {
      toast.error('فشل في استعادة المراجعة')
    } finally {
      setRestoring(false)
      setRestoreTarget(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl" dir="rtl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link to="/articles" className="hover:text-gray-700 dark:hover:text-gray-200">المقالات</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <Link to={`/articles/${id}/edit`} className="hover:text-gray-700 dark:hover:text-gray-200">تعديل المقال</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span className="text-gray-700 dark:text-gray-300">سجل المراجعات</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">سجل المراجعات</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : revisions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>لا توجد مراجعات محفوظة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Revision list */}
          <div className="space-y-2">
            {revisions.map((rev, i) => (
              <button
                key={rev._id}
                onClick={() => setSelected(rev)}
                className={clsx(
                  'w-full text-right p-4 rounded-md border transition-all',
                  selected?._id === rev._id
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/10 dark:border-red-700'
                    : 'border-gray-200 dark:border-gray-700 bg-surface dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    الإصدار {rev.version || revisions.length - i}
                  </span>
                  {i === 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                      الأحدث
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(rev.createdAt)}</p>
                {rev.author && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    بواسطة: {rev.author.displayName || rev.author.name || 'مجهول'}
                  </p>
                )}
                {rev.changesSummary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{rev.changesSummary}</p>
                )}
              </button>
            ))}
          </div>

          {/* Preview panel */}
          {selected ? (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">معاينة الإصدار {selected.version}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDateTime(selected.createdAt)}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRestoreTarget(selected._id)}
                >
                  <RotateCcw className="w-4 h-4 ml-1" />
                  استعادة هذا الإصدار
                </Button>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{selected.title}</h3>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rtl"
                  dangerouslySetInnerHTML={{ __html: selected.content }}
                  dir="rtl"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 card text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">اختر مراجعة للمعاينة</p>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={restoreTarget !== null}
        title="تأكيد الاستعادة"
        message="هل تريد استعادة هذا الإصدار؟ سيتم تحديث المقال بمحتوى هذه المراجعة."
        confirmLabel="استعادة"
        variant="primary"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  )
}
