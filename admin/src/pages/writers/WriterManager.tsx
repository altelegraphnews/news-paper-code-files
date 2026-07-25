import { useEffect, useState } from 'react'
import { usersApi, type UserRecord } from '../../api/users'
import QuickWriterModal from '../../components/users/QuickWriterModal'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Pagination } from '../../components/ui/Pagination'
import toast from 'react-hot-toast'
import { Search, Feather, UserPlus, Edit2, UserCog, Trash2 } from 'lucide-react'

const avatarUrlOf = (u: UserRecord) => (typeof u.avatar === 'object' ? u.avatar?.url : u.avatar) || ''

/**
 * «الكُتّاب» — signature-only writer profiles (name + photo + bio).
 * These are bylines, not accounts: they never log in and don't appear
 * in the editorial-team page. Articles are published under their name
 * via the «الكاتب (التوقيع)» field in the article editor.
 */
export default function WriterManager() {
  const [writers, setWriters] = useState<UserRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editWriter, setEditWriter] = useState<UserRecord | null>(null)
  const [convertWriter, setConvertWriter] = useState<UserRecord | null>(null)
  const [deleteWriter, setDeleteWriter] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteWriter) return
    setDeleting(true)
    try {
      await usersApi.delete(deleteWriter.id || (deleteWriter as any)._id)
      toast.success('تم حذف الكاتب نهائياً')
      setDeleteWriter(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'تعذّر حذف الكاتب')
    } finally {
      setDeleting(false)
    }
  }

  const limit = 12
  const totalPages = Math.ceil(total / limit)

  const load = (p = page) => {
    setLoading(true)
    usersApi.list({ page: p, limit, search: search || undefined, isProfileOnly: 'true' })
      .then((res) => {
        setWriters(res.data?.data || [])
        setTotal(res.data?.meta?.pagination?.total || 0)
      })
      .catch(() => toast.error('فشل في تحميل الكُتّاب'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  // Reclassify as a real login account → managed from the team page again
  const handleConvert = async () => {
    if (!convertWriter) return
    try {
      const id = convertWriter.id || (convertWriter as any)._id
      await usersApi.update(id, { isProfileOnly: false })
      toast.success('تم تحويله إلى حساب حقيقي — تجده الآن في صفحة فريق التحرير')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في التحويل')
    } finally {
      setConvertWriter(null)
    }
  }

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Feather className="w-6 h-6 text-gold-600" />
            الكُتّاب
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ملفات توقيع فقط — أسماء وصور تُنشر المقالات باسمها، ولا تسجّل دخولاً إلى لوحة التحكم
          </p>
        </div>
        <Button variant="gold" onClick={() => { setEditWriter(null); setShowModal(true) }} leftIcon={<UserPlus className="w-4 h-4" />}>
          إضافة كاتب
        </Button>
      </div>

      <div className="morse-line morse-line--subtle mb-6" />

      {/* Search */}
      <form onSubmit={handleSearch} className="relative max-w-sm mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث عن كاتب..."
          className="input-base text-sm !pr-9"
        />
      </form>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : writers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Feather className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {search ? 'لا توجد نتائج مطابقة' : 'لا يوجد كُتّاب بعد — أضف أول كاتب'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {writers.map((w) => {
            const id = w.id || (w as any)._id
            const url = avatarUrlOf(w)
            return (
              <div key={id} className="card p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  {url ? (
                    <img src={url} alt={w.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-gold-400/60 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-ink-900 flex items-center justify-center text-gold-300 text-xl font-bold font-heading shrink-0">
                      {w.name?.charAt(0) || 'ك'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-gray-900 dark:text-gray-100 truncate">{w.name}</p>
                    {w.jobTitle && <p className="text-xs text-gold-700 dark:text-gold-400 truncate">{w.jobTitle}</p>}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 flex-1">
                  {w.bio || 'لا توجد نبذة تعريفية.'}
                </p>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="secondary" size="sm" onClick={() => { setEditWriter(w); setShowModal(true) }} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
                    تعديل
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConvertWriter(w)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gold-600 transition-colors mr-auto"
                    title="تحويل إلى حساب حقيقي يسجّل دخوله"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    حساب حقيقي
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteWriter(w)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                    title="حذف الكاتب نهائياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} pageSize={limit} />
        </div>
      )}

      {/* Create / edit */}
      <QuickWriterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        writer={editWriter}
        onCreated={() => load()}
      />

      {/* Convert to real account */}
      <ConfirmDialog
        isOpen={convertWriter !== null}
        onClose={() => setConvertWriter(null)}
        onConfirm={handleConvert}
        title="تحويل إلى حساب حقيقي؟"
        message={`سيتمكن «${convertWriter?.name ?? ''}» من تسجيل الدخول (بعد إعادة تعيين كلمة المرور) وسيظهر في صفحة فريق التحرير بدلاً من هنا.`}
        confirmLabel="تحويل"
        variant="primary"
      />

      {/* Delete writer */}
      <ConfirmDialog
        isOpen={deleteWriter !== null}
        onClose={() => setDeleteWriter(null)}
        onConfirm={handleDelete}
        title="حذف الكاتب نهائياً؟"
        message={`سيُحذف ملف «${deleteWriter?.name ?? ''}» نهائياً ولا يمكن التراجع. (لا يمكن حذف كاتبٍ له مقالات منشورة — أعد إسنادها إلى كاتبٍ آخر أولاً.)`}
        confirmLabel="حذف نهائي"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  )
}
