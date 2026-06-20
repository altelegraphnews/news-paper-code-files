import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { commentsApi, type Comment } from '../../api/comments'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Pagination } from '../../components/ui/Pagination'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { timeAgo } from '../../utils/dateUtils'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Search, CheckCircle, XCircle, AlertTriangle, Trash2,
  RefreshCw, X, Filter, MessageSquare, ChevronDown,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  spam: 'سبام',
}

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  spam: 'purple',
}

const TABS = [
  { value: 'pending', label: 'بانتظار المراجعة', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'approved', label: 'مقبول', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'rejected', label: 'مرفوض', icon: <XCircle className="w-4 h-4" /> },
  { value: 'spam', label: 'سبام', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: '', label: 'الكل', icon: null },
]

export default function CommentModeration() {
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('')
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | string[] | null>(null)

  const limit = 20
  const totalPages = Math.ceil(total / limit)

  const load = useCallback(() => {
    setLoading(true)
    setSelectedIds([])
    commentsApi.list({ status: statusFilter || undefined, page, limit, search: search || undefined })
      .then((res) => {
        setComments(res.data?.data || [])
        setTotal(res.data?.meta?.pagination?.total || 0)
      })
      .catch(() => toast.error('فشل في تحميل التعليقات'))
      .finally(() => setLoading(false))
  }, [statusFilter, page, search])

  useEffect(() => { load() }, [load])

  const getId = (c: Comment) => (c as any)._id || c.id

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === comments.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(comments.map(getId))
    }
  }

  const updateLocal = (ids: string[], status: string) => {
    setComments((prev) => prev.map((c) => ids.includes(getId(c)) ? { ...c, status: status as any } : c))
    setSelectedIds([])
  }

  const removeLocal = (ids: string[]) => {
    setComments((prev) => prev.filter((c) => !ids.includes(getId(c))))
    setTotal((t) => t - ids.length)
    setSelectedIds([])
  }

  // Single actions
  const handleApprove = async (id: string) => {
    try { await commentsApi.approve(id); updateLocal([id], 'approved'); toast.success('تم قبول التعليق') }
    catch { toast.error('فشل في قبول التعليق') }
  }

  const handleReject = async (id: string) => {
    try { await commentsApi.reject(id); updateLocal([id], 'rejected'); toast.success('تم رفض التعليق') }
    catch { toast.error('فشل في رفض التعليق') }
  }

  const handleSpam = async (id: string) => {
    try { await commentsApi.spam(id); updateLocal([id], 'spam'); toast.success('تم وضع علامة سبام') }
    catch { toast.error('فشل') }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget]
    try {
      if (ids.length === 1) {
        await commentsApi.delete(ids[0])
      } else {
        await commentsApi.bulkDelete(ids)
      }
      removeLocal(ids)
      toast.success(ids.length > 1 ? `تم حذف ${ids.length} تعليقات` : 'تم حذف التعليق')
    } catch { toast.error('فشل في الحذف') }
    finally { setDeleteTarget(null) }
  }

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return
    if (bulkAction === 'delete') { setDeleteTarget([...selectedIds]); return }
    setIsBulkLoading(true)
    try {
      if (bulkAction === 'approve') {
        await commentsApi.bulkApprove(selectedIds)
        updateLocal(selectedIds, 'approved')
        toast.success('تم قبول التعليقات المحددة')
      } else if (bulkAction === 'reject') {
        await commentsApi.bulkReject(selectedIds)
        updateLocal(selectedIds, 'rejected')
        toast.success('تم رفض التعليقات المحددة')
      } else if (bulkAction === 'spam') {
        await commentsApi.bulkSpam(selectedIds)
        updateLocal(selectedIds, 'spam')
        toast.success('تم وضع علامة سبام')
      }
    } catch { toast.error('فشل في تنفيذ الإجراء') }
    finally { setIsBulkLoading(false); setBulkAction('') }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة التعليقات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total.toLocaleString('ar')} تعليق</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1) }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-surface dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        className="relative"
      >
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث في التعليقات..."
          className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-surface dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
        />
      </form>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-100 dark:border-red-800">
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            تم تحديد {selectedIds.length} تعليق
          </span>
          <div className="flex items-center gap-2 mr-auto">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-red-200 dark:border-red-700 bg-surface dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">اختر إجراء...</option>
              <option value="approve">قبول</option>
              <option value="reject">رفض</option>
              <option value="spam">وضع علامة سبام</option>
              <option value="delete">حذف</option>
            </select>
            <Button variant="danger" size="sm" onClick={handleBulkAction} disabled={!bulkAction} isLoading={isBulkLoading}>
              تطبيق
            </Button>
            <button onClick={() => setSelectedIds([])} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="card overflow-hidden">
        {/* Table head */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <input
            type="checkbox"
            checked={comments.length > 0 && selectedIds.length === comments.length}
            onChange={toggleSelectAll}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">التعليق</span>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد تعليقات في هذه الفئة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {comments.map((comment) => {
              const id = getId(comment)
              const isSelected = selectedIds.includes(id)
              return (
                <div
                  key={id}
                  className={clsx(
                    'flex gap-3 p-4 transition-colors',
                    isSelected ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(id)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Author + meta */}
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {comment.authorName || 'زائر'}
                      </span>
                      {comment.authorEmail && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{comment.authorEmail}</span>
                      )}
                      <Badge variant={STATUS_VARIANTS[comment.status]} size="sm">
                        {STATUS_LABELS[comment.status] || comment.status}
                      </Badge>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mr-auto">
                        {timeAgo(comment.createdAt)}
                      </span>
                    </div>

                    {/* Comment content */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {comment.content}
                    </p>

                    {/* Article link */}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      على:{' '}
                      <span className="text-red-600 dark:text-red-400 hover:underline cursor-pointer">
                        {(comment as any).articleTitle || (comment as any).article?.title || 'مقال'}
                      </span>
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {comment.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          قبول
                        </button>
                      )}
                      {comment.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          رفض
                        </button>
                      )}
                      {comment.status !== 'spam' && (
                        <button
                          onClick={() => handleSpam(id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          سبام
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mr-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={total}
          pageSize={limit}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="تأكيد الحذف"
        message={
          Array.isArray(deleteTarget)
            ? `هل تريد حذف ${deleteTarget.length} تعليقات؟`
            : 'هل تريد حذف هذا التعليق؟'
        }
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
