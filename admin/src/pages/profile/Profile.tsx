import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import { mediaApi } from '../../api/media'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import {
  UserCircle, Save, KeyRound, Camera, Twitter, Facebook, Linkedin, Globe,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المدير الأعلى',
  admin: 'مدير',
  editor: 'محرر',
  author: 'كاتب',
  reader: 'قارئ',
}

interface ProfileForm {
  name: string
  nameEn: string
  jobTitle: string
  bio: string
  avatarUrl: string
  socialLinks: {
    twitter: string
    facebook: string
    linkedin: string
    website: string
  }
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState<ProfileForm>({
    name: '', nameEn: '', jobTitle: '', bio: '', avatarUrl: '',
    socialLinks: { twitter: '', facebook: '', linkedin: '', website: '' },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Media picker for avatar
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<any[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)

  // Change password
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    apiClient.get('/auth/me')
      .then((res) => {
        const me = res.data?.data
        setForm({
          name: me.name || '',
          nameEn: me.nameEn || '',
          jobTitle: me.jobTitle || '',
          bio: me.bio || '',
          avatarUrl: me.avatar?.url || '',
          socialLinks: {
            twitter: me.socialLinks?.twitter || '',
            facebook: me.socialLinks?.facebook || '',
            linkedin: me.socialLinks?.linkedin || '',
            website: me.socialLinks?.website || '',
          },
        })
      })
      .catch(() => toast.error('فشل في تحميل الملف الشخصي'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try {
      const res = await apiClient.patch('/auth/me', {
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        jobTitle: form.jobTitle.trim(),
        bio: form.bio.trim(),
        avatar: form.avatarUrl ? { url: form.avatarUrl } : undefined,
        socialLinks: form.socialLinks,
      })
      const updated = res.data?.data
      if (user && updated) {
        setUser({ ...user, name: updated.name, avatar: updated.avatar, jobTitle: updated.jobTitle, bio: updated.bio })
      }
      toast.success('تم حفظ الملف الشخصي — يظهر للقرّاء في صفحة الكاتب')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'); return }
    if (newPassword !== confirmPassword) { toast.error('كلمتا المرور غير متطابقتين'); return }
    setChangingPassword(true)
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('تم تغيير كلمة المرور')
      setShowPasswordModal(false)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في تغيير كلمة المرور')
    } finally {
      setChangingPassword(false)
    }
  }

  const openMediaPicker = () => {
    setShowMediaPicker(true)
    if (mediaAssets.length === 0) {
      setMediaLoading(true)
      mediaApi.list().then((res) => {
        setMediaAssets(res.data?.data?.resources || [])
      }).catch(() => {}).finally(() => setMediaLoading(false))
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCircle className="w-6 h-6 text-gold-600" />
            ملفي الشخصي
          </h1>
          <p className="text-sm text-gray-500 mt-1">هذه المعلومات تظهر للقرّاء في صفحة الكاتب على الموقع</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowPasswordModal(true)} leftIcon={<KeyRound className="w-4 h-4" />}>
          تغيير كلمة المرور
        </Button>
      </div>

      <div className="morse-line morse-line--subtle mb-6" />

      <div className="card p-6 space-y-6">
        {/* Avatar + identity */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="relative group">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={form.name} className="w-24 h-24 rounded-full object-cover ring-2 ring-gold-400/70" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-ink-900 flex items-center justify-center text-gold-300 text-3xl font-bold font-heading">
                {form.name?.charAt(0) ?? 'م'}
              </div>
            )}
            <button
              type="button"
              onClick={openMediaPicker}
              className="absolute bottom-0 left-0 p-1.5 bg-gold-500 text-ink-950 rounded-full shadow hover:bg-gold-400 transition-colors"
              title="تغيير الصورة"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <p className="font-heading text-xl font-bold text-gray-900 dark:text-gray-100">{form.name || '—'}</p>
            <p className="text-sm text-gold-700 dark:text-gold-400">{form.jobTitle || ROLE_LABELS[user?.role ?? ''] || ''}</p>
            <p className="text-xs text-gray-400 mt-1" dir="ltr">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-base">الاسم (توقيع المقالات)</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-base text-sm"
            />
          </div>
          <div>
            <label className="label-base">الاسم بالإنجليزية (اختياري)</label>
            <input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="input-base text-sm"
              dir="ltr"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-base">المسمى الوظيفي (مثال: كاتب رأي — يظهر تحت اسمك)</label>
            <input
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="input-base text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-base">نبذة تعريفية ({form.bio.length}/500)</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
              maxLength={500}
              placeholder="نبذة قصيرة تعرّف القرّاء بك وبما تكتب..."
              className="input-base text-sm resize-none"
            />
          </div>
        </div>

        {/* Social links */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">روابط التواصل (تظهر في صفحة الكاتب)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { key: 'twitter', label: 'تويتر / X', icon: <Twitter className="w-4 h-4" /> },
              { key: 'facebook', label: 'فيسبوك', icon: <Facebook className="w-4 h-4" /> },
              { key: 'linkedin', label: 'لينكدإن', icon: <Linkedin className="w-4 h-4" /> },
              { key: 'website', label: 'موقع شخصي', icon: <Globe className="w-4 h-4" /> },
            ] as const).map(({ key, label, icon }) => (
              <div key={key} className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
                <input
                  value={form.socialLinks[key]}
                  onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, [key]: e.target.value } })}
                  placeholder={label}
                  className="input-base text-sm !pr-10"
                  dir="ltr"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="gold" onClick={handleSave} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            حفظ الملف الشخصي
          </Button>
        </div>
      </div>

      {/* Avatar media picker */}
      <Modal isOpen={showMediaPicker} onClose={() => setShowMediaPicker(false)} title="اختر صورة شخصية" size="lg">
        <div>
          {mediaLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : mediaAssets.length === 0 ? (
            <div className="text-center py-10 text-gray-400">لا توجد صور في المكتبة — ارفع صورة من مكتبة الوسائط أولاً</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {mediaAssets.map((asset) => (
                <button
                  key={asset.public_id}
                  type="button"
                  onClick={() => { setForm({ ...form, avatarUrl: asset.secure_url || asset.url }); setShowMediaPicker(false) }}
                  className="aspect-square rounded-md overflow-hidden border-2 border-transparent hover:border-gold-500 transition-colors"
                >
                  <img src={asset.secure_url || asset.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Change password modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="تغيير كلمة المرور">
        <div className="space-y-4">
          <div>
            <label className="label-base">كلمة المرور الحالية</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-base text-sm"
              dir="ltr"
              autoFocus
            />
          </div>
          <div>
            <label className="label-base">كلمة المرور الجديدة (٨ أحرف على الأقل)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-base text-sm"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label-base">تأكيد كلمة المرور الجديدة</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-base text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="gold" onClick={handleChangePassword} isLoading={changingPassword} className="flex-1">
              تغيير كلمة المرور
            </Button>
            <Button variant="ghost" onClick={() => setShowPasswordModal(false)} className="flex-1">إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
