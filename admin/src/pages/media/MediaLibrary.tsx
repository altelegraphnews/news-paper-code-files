import { useEffect, useState, useCallback, useRef } from 'react'
import { mediaApi, type MediaItem } from '../../api/media'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatBytes, formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Upload, Trash2, Search, RefreshCw, Grid, List,
  X, Copy, Check, Image as ImageIcon, ChevronDown,
} from 'lucide-react'

export default function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [preview, setPreview] = useState<MediaItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | string[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    mediaApi.list({ search: search || undefined, limit: 50 })
      .then((res) => {
        const data = res.data?.data
        setItems(data?.resources || data || [])
        setTotal(data?.total_count || (Array.isArray(data) ? data.length : 0))
      })
      .catch(() => toast.error('فشل في تحميل الوسائط'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load() }, [load])

  const getItemId = (item: MediaItem) => item.publicId || item.id || (item as any).public_id

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const valid = fileArray.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (valid.length === 0) { toast.error('يرجى رفع صور أو مقاطع فيديو فقط'); return }
    setUploading(true)
    setUploadProgress(0)
    let uploaded = 0
    for (const file of valid) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await mediaApi.upload(formData, (pct) => {
          setUploadProgress(Math.round(((uploaded / valid.length) + pct / valid.length / 100) * 100))
        })
        uploaded++
      } catch {
        toast.error(`فشل في رفع ${file.name}`)
      }
    }
    setUploading(false)
    setUploadProgress(0)
    if (uploaded > 0) {
      toast.success(`تم رفع ${uploaded} ملف`)
      load()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget]
    try {
      if (ids.length === 1) {
        await mediaApi.delete(ids[0])
      } else {
        await mediaApi.bulkDelete(ids)
      }
      setItems((prev) => prev.filter((item) => !ids.includes(getItemId(item))))
      setTotal((t) => t - ids.length)
      setSelectedIds([])
      if (preview && ids.includes(getItemId(preview))) setPreview(null)
      toast.success(ids.length > 1 ? `تم حذف ${ids.length} ملفات` : 'تم الحذف')
    } catch { toast.error('فشل في الحذف') }
    finally { setDeleteTarget(null) }
  }

  const copyUrl = (item: MediaItem) => {
    const url = (item as any).secure_url || item.url
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(getItemId(item))
      setTimeout(() => setCopiedId(null), 2000)
      toast.success('تم نسخ الرابط')
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">مكتبة الوسائط</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total.toLocaleString('ar')} ملف</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            {view === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={uploading}>
            <Upload className="w-4 h-4 ml-1" />
            رفع ملفات
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-md border border-blue-100 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">جارٍ الرفع...</span>
            <span className="text-sm text-blue-600 dark:text-blue-300">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="h-2 bg-blue-600 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Drop zone + search */}
      <div
        ref={dropZoneRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-md p-6 text-center transition-colors',
          isDragging
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30'
        )}
      >
        <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          اسحب الملفات وأفلتها هنا أو{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-red-600 hover:underline font-medium"
          >
            اختر ملفات
          </button>
        </p>
        <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP, MP4 — حتى 20 ميجابايت</p>
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput) }}
          className="flex-1 min-w-48 relative"
        >
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ابحث في الوسائط..."
            className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-surface dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          />
        </form>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedIds.length} محدد</span>
            <Button variant="danger" size="sm" onClick={() => setDeleteTarget([...selectedIds])}>
              <Trash2 className="w-4 h-4 ml-1" />
              حذف المحدد
            </Button>
            <button onClick={() => setSelectedIds([])} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Grid / List */}
      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className={clsx('gap-3', view === 'grid' ? 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' : 'flex flex-col')}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={clsx('bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse', view === 'grid' ? 'aspect-square' : 'h-16')} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-gray-400 dark:text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد وسائط</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map((item) => {
                const id = getItemId(item)
                const url = (item as any).secure_url || item.url
                const isSelected = selectedIds.includes(id)
                return (
                  <div
                    key={id}
                    onClick={() => setPreview(item)}
                    className={clsx(
                      'group relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all',
                      isSelected
                        ? 'border-red-500 shadow-md shadow-red-100 dark:shadow-red-900/20'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    {/* Select checkbox */}
                    <div
                      className={clsx(
                        'absolute top-2 right-2 transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(id) }}
                    >
                      <div className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected ? 'bg-red-600 border-red-600' : 'bg-white/80 border-white'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    {/* Quick delete */}
                    <button
                      className="absolute top-2 left-2 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(id) }}
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {items.map((item) => {
                  const id = getItemId(item)
                  const url = (item as any).secure_url || item.url
                  const isSelected = selectedIds.includes(id)
                  return (
                    <div
                      key={id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer',
                        isSelected && 'bg-red-50 dark:bg-red-900/10'
                      )}
                      onClick={() => setPreview(item)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(id) }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500 flex-shrink-0"
                      />
                      <img src={url} alt="" className="w-12 h-9 object-cover rounded flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {item.filename || id}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.format?.toUpperCase()} · {item.width}×{item.height} · {formatBytes(item.bytes || 0)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 hidden md:block">{formatDate(item.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyUrl(item) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title="نسخ الرابط"
                        >
                          {copiedId === id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(id) }}
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
            </div>
          )}
        </div>

        {/* Preview panel */}
        {preview && (
          <div className="w-64 flex-shrink-0 card overflow-hidden sticky top-6 self-start">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">تفاصيل الملف</span>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img
                src={(preview as any).secure_url || preview.url}
                alt=""
                className="w-full rounded-md object-contain max-h-40 bg-gray-100 dark:bg-gray-800"
              />
              <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>النوع</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{preview.format?.toUpperCase() || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>الأبعاد</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {preview.width && preview.height ? `${preview.width}×${preview.height}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>الحجم</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatBytes(preview.bytes || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>تاريخ الرفع</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(preview.createdAt)}</span>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <input
                  value={(preview as any).secure_url || preview.url}
                  readOnly
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  dir="ltr"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyUrl(preview)}
                >
                  {copiedId === getItemId(preview) ? <Check className="w-3.5 h-3.5 ml-1 text-green-500" /> : <Copy className="w-3.5 h-3.5 ml-1" />}
                  نسخ الرابط
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => setDeleteTarget(getItemId(preview))}
                >
                  <Trash2 className="w-3.5 h-3.5 ml-1" />
                  حذف
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="تأكيد الحذف"
        message={
          Array.isArray(deleteTarget)
            ? `هل تريد حذف ${deleteTarget.length} ملفات؟ لا يمكن التراجع.`
            : 'هل تريد حذف هذا الملف؟ لا يمكن التراجع.'
        }
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
