import { useEffect, useMemo, useState } from 'react'
import { usersApi, type UserRecord } from '../../api/users'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Badge } from '../../components/ui/Badge'
import { Pagination } from '../../components/ui/Pagination'
import { timeAgo } from '../../utils/dateUtils'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Search, RefreshCw, Edit2, UserX, UserCheck, Key, UserPlus,
  ShieldCheck, PenLine, Eye, EyeOff, Copy, Check,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المدير الأعلى',
  admin: 'مدير',
  editor: 'محرر',
  author: 'كاتب',
  reader: 'قارئ',
}

const ROLE_VARIANTS: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default' | 'gold'> = {
  super_admin: 'danger',
  admin: 'gold',
  editor: 'info',
  author: 'success',
  reader: 'default',
}

// Arabic labels for every permission key, grouped for the privileges editor
const PERMISSION_GROUPS: { title: string; keys: { key: string; label: string }[] }[] = [
  {
    title: 'المقالات',
    keys: [
      { key: 'articles.create',  label: 'كتابة مقالات جديدة' },
      { key: 'articles.editOwn', label: 'تعديل مقالاته الخاصة' },
      { key: 'articles.editAll', label: 'تعديل جميع المقالات' },
      { key: 'articles.publish', label: 'النشر والموافقة على المقالات' },
      { key: 'articles.delete',  label: 'حذف المقالات' },
      { key: 'articles.feature', label: 'تمييز المقالات (رئيسي/عاجل)' },
    ],
  },
  {
    title: 'المحتوى والإشراف',
    keys: [
      { key: 'comments.moderate', label: 'إدارة التعليقات' },
      { key: 'categories.manage', label: 'إدارة التصنيفات' },
      { key: 'media.upload',      label: 'رفع الصور والوسائط' },
      { key: 'media.manage',      label: 'إدارة مكتبة الوسائط' },
    ],
  },
  {
    title: 'الموقع',
    keys: [
      { key: 'tickers.manage',     label: 'إدارة الشريط الإخباري' },
      { key: 'homepage.manage',    label: 'إدارة الصفحة الرئيسية' },
      { key: 'notifications.send', label: 'إرسال الإشعارات' },
    ],
  },
  {
    title: 'الإدارة',
    keys: [
      { key: 'users.manage',    label: 'إدارة فريق التحرير' },
      { key: 'analytics.view',  label: 'عرض الإحصائيات' },
      { key: 'settings.manage', label: 'إدارة إعدادات الموقع' },
    ],
  },
]

function UserAvatar({ user }: { user: UserRecord }) {
  const url = typeof user.avatar === 'object' ? user.avatar?.url : user.avatar
  if (url) {
    return <img src={url} alt={user.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-gold-300/60" />
  }
  const initials = user.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '؟'
  return (
    <div className="w-9 h-9 rounded-full bg-ink-900 flex items-center justify-center text-gold-300 text-sm font-bold">
      {initials}
    </div>
  )
}

/* ─── Privileges editor: per-key toggle on top of role defaults ─── */
function PermissionsEditor({
  roleDefaults,
  overrides,
  onChange,
}: {
  roleDefaults: Set<string>
  overrides: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}) {
  const effective = (key: string) =>
    overrides[key] !== undefined ? overrides[key] : roleDefaults.has(key)

  const toggle = (key: string) => {
    const next = { ...overrides }
    const newValue = !effective(key)
    // Drop the override when it matches the role default again
    if (newValue === roleDefaults.has(key)) {
      delete next[key]
    } else {
      next[key] = newValue
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-semibold text-gold-700 dark:text-gold-400 mb-2">{group.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {group.keys.map(({ key, label }) => {
              const checked = effective(key)
              const isOverride = overrides[key] !== undefined
              return (
                <label
                  key={key}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm',
                    checked
                      ? 'border-gold-300 bg-gold-50 dark:bg-gold-900/15 dark:border-gold-700 text-gray-800 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="accent-[#b8923d] w-4 h-4 flex-shrink-0"
                  />
                  <span className="flex-1">{label}</span>
                  {isOverride && (
                    <span className="text-[10px] text-gold-600 dark:text-gold-400 font-medium" title="مخصص — يختلف عن الدور الافتراضي">
                      مخصص
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

interface UserFormState {
  name: string
  email: string
  password: string
  role: string
  jobTitle: string
  overrides: Record<string, boolean>
}

const emptyForm: UserFormState = { name: '', email: '', password: '', role: 'author', jobTitle: '', overrides: {} }

export default function UserManager() {
  const currentUser = useAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [users, setUsers] = useState<UserRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [roleDefaultsMap, setRoleDefaultsMap] = useState<Record<string, string[]>>({})

  // Create / edit modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserRecord | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)

  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const limit = 15
  const totalPages = Math.ceil(total / limit)

  const roleDefaults = useMemo(
    () => new Set(roleDefaultsMap[form.role] ?? []),
    [roleDefaultsMap, form.role]
  )

  const load = (p = page) => {
    setLoading(true)
    usersApi.list({ page: p, limit, search: search || undefined, role: roleFilter || undefined })
      .then((res) => {
        setUsers(res.data?.data || [])
        setTotal(res.data?.meta?.pagination?.total || 0)
      })
      .catch(() => toast.error('فشل في تحميل فريق التحرير'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search, roleFilter])

  useEffect(() => {
    usersApi.permissionKeys()
      .then((res) => setRoleDefaultsMap(res.data?.data?.roleDefaults ?? {}))
      .catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditUserId(null)
    setModalMode('create')
    setShowPassword(false)
  }

  const openEdit = (user: UserRecord) => {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      jobTitle: user.jobTitle ?? '',
      overrides: { ...(user.permissionOverrides ?? {}) },
    })
    setEditUserId(user.id || (user as any)._id)
    setModalMode('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال الاسم'); return }
    if (modalMode === 'create') {
      if (!form.email.trim()) { toast.error('يرجى إدخال البريد الإلكتروني'); return }
      if (form.password.length < 8) { toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        await usersApi.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          jobTitle: form.jobTitle.trim() || undefined,
          permissionOverrides: form.overrides,
        })
        toast.success('تم إنشاء الحساب بنجاح')
      } else if (editUserId) {
        await usersApi.update(editUserId, {
          name: form.name.trim(),
          role: form.role as any,
          jobTitle: form.jobTitle.trim(),
          permissionOverrides: form.overrides,
        })
        toast.success('تم تحديث الحساب والصلاحيات')
      }
      setModalMode(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!deactivateId) return
    try {
      await usersApi.toggleActive(deactivateId)
      setUsers((prev) => prev.map((u) => {
        const uid = u.id || (u as any)._id
        return uid === deactivateId ? { ...u, isActive: !u.isActive } : u
      }))
      toast.success('تم تغيير حالة الحساب')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في تغيير الحالة')
    } finally {
      setDeactivateId(null)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    if (resetPassword && resetPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }
    setResetting(true)
    try {
      const res = await usersApi.resetPassword(resetUser.id || (resetUser as any)._id, resetPassword || undefined)
      const temp = res.data?.data?.tempPassword
      if (temp) {
        setResetResult(temp)
      } else {
        toast.success('تم تعيين كلمة المرور الجديدة')
        setResetUser(null)
        setResetPassword('')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في إعادة التعيين')
    } finally {
      setResetting(false)
    }
  }

  const copyTemp = () => {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const assignableRoles = isSuperAdmin ? ['author', 'editor', 'admin'] : ['author', 'editor']

  return (
    <div className="p-6 max-w-6xl" dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100">فريق التحرير</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total} عضو — الكتّاب والمحررون والإداريون</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="p-2 text-gray-500 hover:text-gold-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="gold" size="sm" onClick={openCreate} leftIcon={<UserPlus className="w-4 h-4" />}>
            إنشاء حساب كاتب
          </Button>
        </div>
      </div>

      <div className="morse-line morse-line--subtle mb-5" />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <form onSubmit={handleSearch} className="flex-1 min-w-48 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ابحث بالاسم أو البريد..."
            className="w-full pr-9 pl-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-surface dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />
        </form>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-surface dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
        >
          <option value="">كل الأدوار</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40">
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">العضو</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">الدور</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">المقالات</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">آخر دخول</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">الحالة</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">لا توجد نتائج</td>
              </tr>
            ) : users.map((user) => {
              const uid = user.id || (user as any)._id
              const isSelf = (currentUser as any)?._id === uid || currentUser?.id === uid
              const isProtected = user.role === 'super_admin' || (user.role === 'admin' && !isSuperAdmin)
              return (
                <tr key={uid} className="hover:bg-gold-50/40 dark:hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {user.name}
                          {isSelf && <span className="mr-2 text-xs text-gold-600">(أنت)</span>}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500" dir="ltr">{user.email}</p>
                        {user.jobTitle && <p className="text-xs text-gold-700 dark:text-gold-400 mt-0.5">{user.jobTitle}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">
                        {['super_admin', 'admin'].includes(user.role)
                          ? <ShieldCheck className="w-4 h-4 text-gold-600" />
                          : <PenLine className="w-4 h-4" />}
                      </span>
                      <Badge variant={ROLE_VARIANTS[user.role] || 'default'}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                      {user.permissionOverrides && Object.keys(user.permissionOverrides).length > 0 && (
                        <span className="text-[10px] text-gold-600 dark:text-gold-400" title="صلاحيات مخصصة">✦</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {user.articlesCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {user.lastLoginAt ? timeAgo(user.lastLoginAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={user.isActive ? 'success' : 'danger'}>
                      {user.isActive ? 'نشط' : 'موقوف'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!isProtected && (
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-gray-400 hover:text-gold-700 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-md transition-colors"
                          title="تعديل الحساب والصلاحيات"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {!isProtected && (
                        <button
                          onClick={() => { setResetUser(user); setResetPassword(''); setResetResult(null) }}
                          className="p-1.5 text-gray-400 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      )}
                      {!isSelf && !isProtected && (
                        <button
                          onClick={() => setDeactivateId(uid)}
                          className={clsx(
                            'p-1.5 rounded-md transition-colors',
                            user.isActive
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          )}
                          title={user.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                        >
                          {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} pageSize={limit} />
        </div>
      )}

      {/* Create / Edit account modal */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'create' ? 'إنشاء حساب جديد' : 'تعديل الحساب والصلاحيات'}
        size="2xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">الاسم الكامل (سيظهر كتوقيع الكاتب)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: ليلى الحسن"
                className="input-base text-sm"
                autoFocus={modalMode === 'create'}
              />
            </div>
            <div>
              <label className="label-base">المسمى الوظيفي (اختياري)</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="مثال: كاتبة رأي"
                className="input-base text-sm"
              />
            </div>
            <div>
              <label className="label-base">البريد الإلكتروني</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="writer@altilgraf.com"
                className="input-base text-sm disabled:opacity-60"
                dir="ltr"
                disabled={modalMode === 'edit'}
              />
            </div>
            {modalMode === 'create' && (
              <div>
                <label className="label-base">كلمة المرور (٨ أحرف على الأقل)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="input-base text-sm !pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="label-base">الدور</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, overrides: {} })}
                className="input-base text-sm"
              >
                {assignableRoles.map((v) => (
                  <option key={v} value={v}>{ROLE_LABELS[v] || v}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {form.role === 'author' && 'الكاتب: يكتب مقالات باسمه ويرسلها للمراجعة قبل النشر.'}
                {form.role === 'editor' && 'المحرر: يراجع وينشر ويعدّل جميع المقالات.'}
                {form.role === 'admin' && 'المدير: جميع الصلاحيات بما فيها إدارة الفريق.'}
              </p>
            </div>
          </div>

          {/* Privileges */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">الصلاحيات</h3>
              <span className="text-xs text-gray-400">المحددة افتراضياً تتبع الدور — عدّلها حسب الحاجة</span>
            </div>
            <PermissionsEditor
              roleDefaults={roleDefaults}
              overrides={form.overrides}
              onChange={(overrides) => setForm({ ...form, overrides })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="gold" onClick={handleSave} isLoading={saving} className="flex-1">
              {modalMode === 'create' ? 'إنشاء الحساب' : 'حفظ التغييرات'}
            </Button>
            <Button variant="ghost" onClick={() => setModalMode(null)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        isOpen={resetUser !== null}
        onClose={() => { setResetUser(null); setResetResult(null) }}
        title={`إعادة تعيين كلمة مرور — ${resetUser?.name ?? ''}`}
      >
        {resetResult ? (
          <div className="space-y-4 text-center py-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">كلمة المرور المؤقتة الجديدة:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gold-300 dark:border-gold-700 rounded-md text-base font-mono tracking-wider" dir="ltr">
                {resetResult}
              </code>
              <button onClick={copyTemp} className="p-2 text-gray-400 hover:text-gold-700 rounded-md" title="نسخ">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">سلّمها للكاتب — لن تظهر مرة أخرى.</p>
            <Button variant="primary" onClick={() => { setResetUser(null); setResetResult(null) }} className="w-full">تم</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label-base">كلمة مرور جديدة (اتركها فارغة لتوليد واحدة تلقائياً)</label>
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="اختياري"
                className="input-base text-sm"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-gray-400">سيتم تسجيل خروج المستخدم من جميع الأجهزة.</p>
            <div className="flex gap-3">
              <Button variant="gold" onClick={handleResetPassword} isLoading={resetting} className="flex-1">
                إعادة التعيين
              </Button>
              <Button variant="ghost" onClick={() => setResetUser(null)} className="flex-1">إلغاء</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deactivateId !== null}
        title="تأكيد تغيير الحالة"
        message="هل تريد تغيير حالة هذا الحساب؟ تعطيل الحساب يمنع صاحبه من تسجيل الدخول."
        confirmLabel="تأكيد"
        variant="primary"
        onConfirm={handleToggleActive}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  )
}
