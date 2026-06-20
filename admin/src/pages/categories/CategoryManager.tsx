import { useEffect, useState } from 'react'
import { categoriesApi, type Category } from '../../api/categories'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Badge } from '../../components/ui/Badge'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Plus, Edit2, Trash2, GripVertical, ChevronDown, ChevronRight,
  RefreshCw, Eye, EyeOff,
} from 'lucide-react'

const EMPTY_FORM = { name: '', slug: '', description: '', parentId: '', isActive: true }

function slugify(text: string): string {
  return text.trim().replace(/\s+/g, '-').replace(/[^\u0600-\u06FF\w-]/g, '').toLowerCase().slice(0, 100)
}

interface CategoryRowProps {
  category: Category
  depth: number
  children?: Category[]
  onEdit: (cat: Category) => void
  onDelete: (id: string) => void
  onToggleActive: (cat: Category) => void
  dragId: string | null
  onDragStart: (id: string) => void
  onDrop: (targetId: string) => void
}

function CategoryRow({ category, depth, children = [], onEdit, onDelete, onToggleActive, dragId, onDragStart, onDrop }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = children.length > 0

  return (
    <>
      <tr
        draggable
        onDragStart={() => onDragStart(category.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(category.id)}
        className={clsx(
          'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
          dragId === category.id && 'opacity-40'
        )}
      >
        <td className="px-4 py-3 w-8">
          <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingRight: depth * 20 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{category.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">/{category.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
          {category.description || '—'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          {category.articleCount ?? 0}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant={category.isActive ? 'success' : 'default'}>
            {category.isActive ? 'نشط' : 'مخفي'}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onToggleActive(category)}
              className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
              title={category.isActive ? 'إخفاء' : 'إظهار'}
            >
              {category.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(category)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="تعديل"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(category.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="حذف"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && children.map((child) => (
        <CategoryRow
          key={child.id}
          category={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
          dragId={dragId}
          onDragStart={onDragStart}
          onDrop={onDrop}
        />
      ))}
    </>
  )
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    categoriesApi.list()
      .then((res) => {
        const raw: any[] = res.data?.data || []
        setCategories(raw.map((c) => ({
          ...c,
          id: c._id || c.id,
          parentId: c.parent ?? c.parentId ?? null,
        })))
      })
      .catch(() => toast.error('فشل في تحميل التصنيفات'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Auto-slug
  useEffect(() => {
    if (!slugEdited && form.name) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))
    }
  }, [form.name, slugEdited])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setSlugEdited(false)
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', parentId: cat.parentId || '', isActive: cat.isActive })
    setEditId(cat.id)
    setSlugEdited(true)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم التصنيف'); return }
    if (!form.slug.trim()) { toast.error('يرجى إدخال رابط التصنيف'); return }
    setSaving(true)
    try {
      if (editId) {
        await categoriesApi.update(editId, form)
        toast.success('تم تحديث التصنيف')
      } else {
        await categoriesApi.create(form)
        toast.success('تم إنشاء التصنيف')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في حفظ التصنيف')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await categoriesApi.delete(deleteId)
      toast.success('تم حذف التصنيف')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في حذف التصنيف')
    } finally {
      setDeleteId(null)
    }
  }

  const handleToggleActive = async (cat: Category) => {
    try {
      await categoriesApi.update(cat.id, { isActive: !cat.isActive })
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
    } catch {
      toast.error('فشل في تغيير الحالة')
    }
  }

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ids = categories.map((c) => c.id)
    const fromIndex = ids.indexOf(dragId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) { setDragId(null); return }
    const reordered = [...ids]
    reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, dragId)
    setDragId(null)
    try {
      await categoriesApi.reorder(reordered.map((cid, index) => ({ id: cid, order: index })))
      load()
    } catch {
      toast.error('فشل في إعادة الترتيب')
    }
  }

  const parentCategories = categories.filter((c) => !c.parentId)
  const getChildren = (parentId: string) => categories.filter((c) => c.parentId === parentId)

  return (
    <div className="p-6 max-w-5xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التصنيفات</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 ml-1" />
            تصنيف جديد
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">الاسم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">الوصف</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">المقالات</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">الحالة</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : parentCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  لا توجد تصنيفات
                </td>
              </tr>
            ) : (
              parentCategories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  depth={0}
                  children={getChildren(cat.id)}
                  onEdit={openEdit}
                  onDelete={setDeleteId}
                  onToggleActive={handleToggleActive}
                  dragId={dragId}
                  onDragStart={setDragId}
                  onDrop={handleDrop}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'تعديل التصنيف' : 'تصنيف جديد'}
      >
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">اسم التصنيف *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="أدخل اسم التصنيف"
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              الرابط (Slug) *
            </label>
            <div className="flex gap-2">
              <input
                value={form.slug}
                onChange={(e) => { setForm((p) => ({ ...p, slug: e.target.value })); setSlugEdited(true) }}
                placeholder="category-slug"
                className="flex-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => { setForm((p) => ({ ...p, slug: slugify(p.name) })); setSlugEdited(false) }}
                className="px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                توليد
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="وصف مختصر للتصنيف"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">التصنيف الأب</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="">بدون تصنيف أب (رئيسي)</option>
              {categories.filter((c) => !c.parentId && c.id !== editId).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">التصنيف نشط ومرئي</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleSave} isLoading={saving} className="flex-1">
              {editId ? 'حفظ التغييرات' : 'إنشاء التصنيف'}
            </Button>
            <Button variant="ghost" onClick={() => setShowModal(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="تأكيد الحذف"
        message="هل تريد حذف هذا التصنيف؟ سيتم إزالة جميع المقالات المرتبطة به من هذا التصنيف."
        confirmLabel="حذف"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
