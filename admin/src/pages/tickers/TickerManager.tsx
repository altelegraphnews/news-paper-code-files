import { useEffect, useState } from 'react'
import { tickersApi, type Ticker } from '../../api/tickers'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { Plus, Edit2, Trash2, GripVertical, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react'

const EMPTY_FORM = {
  text: '',
  url: '',
  isActive: true,
  priority: 0,
  startAt: '',
  endAt: '',
}

export default function TickerManager() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const getId = (t: Ticker) => (t as any)._id || t.id

  const load = () => {
    setLoading(true)
    tickersApi.list()
      .then((res) => setTickers(res.data?.data || []))
      .catch(() => toast.error('فشل في تحميل الأخبار العاجلة'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowModal(true)
  }

  const openEdit = (ticker: Ticker) => {
    setForm({
      text: ticker.text || (ticker as any).headline || '',
      url: ticker.url || (ticker as any).link || '',
      isActive: ticker.isActive,
      priority: ticker.priority || 0,
      startAt: ticker.startAt ? ticker.startAt.slice(0, 16) : '',
      endAt: ticker.endAt ? ticker.endAt.slice(0, 16) : '',
    })
    setEditId(getId(ticker))
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.text.trim()) { toast.error('يرجى إدخال نص الخبر'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        url: form.url || undefined,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      }
      if (editId) {
        await tickersApi.update(editId, payload)
        toast.success('تم تحديث الخبر')
      } else {
        await tickersApi.create(payload)
        toast.success('تم إنشاء الخبر')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await tickersApi.delete(deleteId)
      toast.success('تم حذف الخبر')
      load()
    } catch {
      toast.error('فشل في الحذف')
    } finally {
      setDeleteId(null)
    }
  }

  const handleToggleActive = async (ticker: Ticker) => {
    const id = getId(ticker)
    try {
      await tickersApi.toggleActive(id)
      setTickers((prev) => prev.map((t) => getId(t) === id ? { ...t, isActive: !t.isActive } : t))
    } catch {
      toast.error('فشل في تغيير الحالة')
    }
  }

  const handleDragStart = (id: string) => setDragId(id)

  const handleDrop = async (targetId: string) => {
    setDragOver(null)
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ids = tickers.map(getId)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return }
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, dragId)
    // optimistic update
    const reorderedTickers = reordered.map((id) => tickers.find((t) => getId(t) === id)!)
    setTickers(reorderedTickers)
    setDragId(null)
    try {
      await tickersApi.reorder(reordered)
    } catch {
      toast.error('فشل في إعادة الترتيب')
      load()
    }
  }

  return (
    <div className="p-6 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">شريط الأخبار العاجلة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tickers.filter((t) => t.isActive).length} خبر نشط من أصل {tickers.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-1" />
            خبر جديد
          </Button>
        </div>
      </div>

      {/* Live preview */}
      {tickers.filter((t) => t.isActive).length > 0 && (
        <div className="mb-5 rounded-md overflow-hidden bg-ink-950 border border-gold-900/40">
          <div className="flex items-center">
            <span className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-l from-red-700 to-red-900 text-white text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
              برقيات
            </span>
            <div className="text-gray-100 text-sm font-medium overflow-hidden px-3">
              <div className="flex items-center gap-6">
                {tickers.filter((t) => t.isActive).map((t) => (
                  <span key={getId(t)} className="whitespace-nowrap flex items-center gap-6">
                    {t.text}
                    <span className="text-gold-400 text-[0.55rem] tracking-[0.35em]" aria-hidden="true">— ▪ —</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickers list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : tickers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد أخبار عاجلة</p>
            <button onClick={openCreate} className="mt-3 text-sm text-red-600 hover:underline">
              أضف أول خبر
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {tickers.map((ticker) => {
              const id = getId(ticker)
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(id)}
                  className={clsx(
                    'flex items-center gap-3 p-4 transition-colors',
                    dragId === id && 'opacity-40',
                    dragOver === id && dragId !== id && 'bg-red-50 dark:bg-red-900/10',
                    'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  )}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-grab flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx(
                        'text-sm font-medium',
                        ticker.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'
                      )}>
                        {ticker.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {ticker.url && (
                        <span className="text-xs text-gray-400 truncate max-w-xs" dir="ltr">{ticker.url}</span>
                      )}
                      {ticker.startAt && (
                        <span className="text-xs text-gray-400">من: {formatDate(ticker.startAt)}</span>
                      )}
                      {ticker.endAt && (
                        <span className="text-xs text-gray-400">إلى: {formatDate(ticker.endAt)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(ticker)}
                      className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        ticker.isActive
                          ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                      title={ticker.isActive ? 'إخفاء' : 'إظهار'}
                    >
                      {ticker.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(ticker)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'تعديل الخبر' : 'خبر جديد'}
      >
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">نص الخبر *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
              placeholder="أدخل نص الخبر العاجل..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">{form.text.length} حرف</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">الرابط (اختياري)</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">يبدأ من</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ينتهي في</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">نشط</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleSave} isLoading={saving} className="flex-1">
              {editId ? 'حفظ التغييرات' : 'إضافة الخبر'}
            </Button>
            <Button variant="ghost" onClick={() => setShowModal(false)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="تأكيد الحذف"
        message="هل تريد حذف هذا الخبر من شريط الأخبار؟"
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
