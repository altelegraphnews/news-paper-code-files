import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { articlesApi } from '../../api/articles'
import { categoriesApi, type Category } from '../../api/categories'
import { useArticleStore, type Article } from '../../store/articleStore'
import { Table } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatDate, timeAgo } from '../../utils/dateUtils'
import {
  Plus, Search, Filter, Trash2, Eye, EyeOff, Edit2, RotateCcw,
  ChevronDown, X, RefreshCw, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  pending: 'بانتظار المراجعة',
  rejected: 'أُعيد مع ملاحظات',
  scheduled: 'مجدول',
  published: 'منشور',
  archived: 'مؤرشف',
}

const STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'purple' | 'danger' | 'gold'> = {
  draft: 'default',
  pending: 'gold',
  rejected: 'danger',
  scheduled: 'info',
  published: 'success',
  archived: 'purple',
}

// Map UI filter state → backend query params
const SORT_FIELD_MAP: Record<string, string> = {
  createdAt: 'createdAt',
  publishedAt: 'publishedAt',
  views: 'views.total',
}

export default function ArticleList() {
  const navigate = useNavigate()
  const can = useAuthStore((s) => s.can)
  const canPublish = can('articles.publish')
  const canDelete = can('articles.delete')
  const canEditAll = can('articles.editAll')

  const {
    articles, totalCount, isLoading, filters, selectedIds,
    setArticles, setFilters, setLoading, toggleSelected, selectAll, clearSelected,
    updateArticleInList, removeArticleFromList,
  } = useArticleStore()

  const [categories, setCategories] = useState<Category[]>([])
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const [showFilters, setShowFilters] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | string[] | null>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  const totalPages = Math.ceil(totalCount / filters.limit)

  const loadArticles = useCallback(async () => {
    setLoading(true)
    try {
      const sortField = SORT_FIELD_MAP[filters.sortBy] || 'createdAt'
      const params: Record<string, any> = {
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        status: filters.status || undefined,
        category: filters.categoryId || undefined,
        sort: filters.sortOrder === 'asc' ? sortField : `-${sortField}`,
      }
      // Writers see their own articles in every status
      if (!canEditAll) params.mine = 'true'

      const res = await articlesApi.list(params as any)
      const data = res.data?.data || []
      const total = res.data?.meta?.pagination?.total || 0
      setArticles(data, total)
    } catch {
      toast.error('فشل في تحميل المقالات')
    } finally {
      setLoading(false)
    }
  }, [filters, canEditAll, setArticles, setLoading])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  useEffect(() => {
    categoriesApi.list().then((res) => {
      const raw: any[] = res.data?.data || []
      setCategories(raw.map((c) => ({ ...c, id: c._id || c.id })))
    }).catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ search: searchInput, page: 1 })
  }

  const handleSort = (key: string) => {
    setFilters({
      sortBy: key,
      sortOrder: filters.sortBy === key && filters.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    })
  }

  const handlePublish = async (id: string) => {
    try {
      await articlesApi.publish(id)
      updateArticleInList(id, { status: 'published' } as Partial<Article>)
      toast.success('تم النشر بنجاح')
    } catch {
      toast.error('فشل في النشر')
    }
  }

  const handleUnpublish = async (id: string) => {
    try {
      await articlesApi.unpublish(id)
      updateArticleInList(id, { status: 'draft' } as Partial<Article>)
      toast.success('تم إلغاء النشر')
    } catch {
      toast.error('فشل في إلغاء النشر')
    }
  }

  const handleSubmitForReview = async (id: string) => {
    try {
      await articlesApi.submit(id)
      updateArticleInList(id, { status: 'pending' } as any)
      toast.success('أُرسل المقال للمراجعة')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الإرسال للمراجعة')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      if (Array.isArray(deleteTarget)) {
        await articlesApi.bulkDelete(deleteTarget)
        deleteTarget.forEach(removeArticleFromList)
        clearSelected()
        toast.success(`تم حذف ${deleteTarget.length} مقالات`)
      } else {
        await articlesApi.delete(deleteTarget)
        removeArticleFromList(deleteTarget)
        toast.success('تم حذف المقال')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الحذف')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return
    setIsBulkLoading(true)
    try {
      if (bulkAction === 'delete') {
        setDeleteTarget([...selectedIds])
      } else if (bulkAction === 'publish') {
        await articlesApi.bulkStatus(selectedIds, 'published')
        selectedIds.forEach((id) => updateArticleInList(id, { status: 'published' } as Partial<Article>))
        clearSelected()
        toast.success('تم نشر المقالات المحددة')
      } else if (bulkAction === 'unpublish') {
        await articlesApi.bulkStatus(selectedIds, 'draft')
        selectedIds.forEach((id) => updateArticleInList(id, { status: 'draft' } as Partial<Article>))
        clearSelected()
        toast.success('تم إلغاء نشر المقالات المحددة')
      } else if (bulkAction === 'archive') {
        await articlesApi.bulkStatus(selectedIds, 'archived')
        selectedIds.forEach((id) => updateArticleInList(id, { status: 'archived' } as Partial<Article>))
        clearSelected()
        toast.success('تم أرشفة المقالات المحددة')
      }
    } catch {
      toast.error('فشل في تنفيذ الإجراء')
    } finally {
      setIsBulkLoading(false)
      setBulkAction('')
    }
  }

  const columns = [
    {
      key: 'title',
      label: 'العنوان',
      sortable: true,
      render: (row: Article) => (
        <div className="max-w-sm">
          <Link
            to={`/articles/${(row as any)._id || row.id}/edit`}
            className="font-medium text-gray-900 dark:text-gray-100 hover:text-red-600 dark:hover:text-red-400 transition-colors line-clamp-2"
          >
            {row.title}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {(row as any).isBreaking && (
              <Badge variant="danger" size="sm">عاجل</Badge>
            )}
            {(row as any).isFeatured && (
              <Badge variant="info" size="sm">مميز</Badge>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {timeAgo((row as any).createdAt)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      width: 'w-32',
      render: (row: Article) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'default'}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: 'التصنيف',
      width: 'w-32',
      render: (row: Article) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {(row as any).category?.name || '—'}
        </span>
      ),
    },
    {
      key: 'author',
      label: 'الكاتب',
      width: 'w-32',
      render: (row: Article) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {(row as any).author?.displayName || (row as any).author?.name || '—'}
        </span>
      ),
    },
    {
      key: 'views',
      label: 'المشاهدات',
      sortable: true,
      width: 'w-24',
      render: (row: Article) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {((row as any).views?.total || 0).toLocaleString('ar')}
        </span>
      ),
    },
    {
      key: 'publishedAt',
      label: 'تاريخ النشر',
      sortable: true,
      width: 'w-36',
      render: (row: Article) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {(row as any).publishedAt ? formatDate((row as any).publishedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      width: 'w-32',
      render: (row: Article) => {
        const id = (row as any)._id || row.id
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/articles/${id}/edit`)}
              className="p-1.5 text-gray-400 hover:text-gold-700 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-md transition-colors"
              title="تعديل"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {canPublish ? (
              row.status === 'published' ? (
                <button
                  onClick={() => handleUnpublish(id)}
                  className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
                  title="إلغاء النشر"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handlePublish(id)}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                  title="نشر"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )
            ) : (
              ['draft', 'rejected'].includes(row.status as string) && (
                <button
                  onClick={() => handleSubmitForReview(id)}
                  className="p-1.5 text-gray-400 hover:text-gold-700 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-md transition-colors"
                  title="إرسال للمراجعة"
                >
                  <Send className="w-4 h-4" />
                </button>
              )
            )}
            <button
              onClick={() => navigate(`/articles/${id}/revisions`)}
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
              title="المراجعات"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {canDelete && (
              <button
                onClick={() => setDeleteTarget(id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 space-y-5 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المقالات</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadArticles}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link to="/articles/new">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 ml-1" />
              مقال جديد
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن مقال..."
              className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors',
              showFilters
                ? 'border-red-300 bg-red-50 text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <Filter className="w-4 h-4" />
            تصفية
            <ChevronDown className={clsx('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100 dark:border-gray-700">
            {/* Status filter */}
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })}
              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={filters.categoryId || ''}
              onChange={(e) => setFilters({ categoryId: e.target.value || undefined, page: 1 })}
              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="">كل التصنيفات</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Limit */}
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ limit: Number(e.target.value), page: 1 })}
              className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value={10}>10 لكل صفحة</option>
              <option value={20}>20 لكل صفحة</option>
              <option value={50}>50 لكل صفحة</option>
            </select>

            {/* Clear filters */}
            {(filters.status || filters.categoryId || filters.search) && (
              <button
                onClick={() => {
                  setFilters({ status: undefined, categoryId: undefined, search: undefined, page: 1 })
                  setSearchInput('')
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
                مسح الفلاتر
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (canPublish || canDelete) && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-100 dark:border-red-800">
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            تم تحديد {selectedIds.length} مقال
          </span>
          <div className="flex items-center gap-2 mr-auto">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-red-200 dark:border-red-700 bg-surface dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">اختر إجراء...</option>
              {canPublish && <option value="publish">نشر</option>}
              {canPublish && <option value="unpublish">إلغاء النشر</option>}
              {canPublish && <option value="archive">أرشفة</option>}
              {canDelete && <option value="delete">حذف</option>}
            </select>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkAction}
              disabled={!bulkAction}
              isLoading={isBulkLoading}
            >
              تطبيق
            </Button>
            <button
              onClick={clearSelected}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <Table
          columns={columns as any}
          data={articles as any[]}
          keyField={'_id' as any}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onSelectAll={() => {
            if (selectedIds.length === articles.length) {
              clearSelected()
            } else {
              selectAll(articles.map((a: any) => a._id || a.id))
            }
          }}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={handleSort}
          isLoading={isLoading}
          emptyMessage="لا توجد مقالات"
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={filters.page}
          totalPages={totalPages}
          onPageChange={(page) => setFilters({ page })}
          totalItems={totalCount}
          pageSize={filters.limit}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="تأكيد الحذف"
        message={
          Array.isArray(deleteTarget)
            ? `هل أنت متأكد من حذف ${deleteTarget.length} مقالات؟ لا يمكن التراجع عن هذا الإجراء.`
            : 'هل أنت متأكد من حذف هذا المقال؟ لا يمكن التراجع عن هذا الإجراء.'
        }
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
