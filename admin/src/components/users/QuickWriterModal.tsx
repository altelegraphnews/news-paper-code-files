import { useEffect, useRef, useState } from 'react'
import { usersApi, type UserRecord } from '../../api/users'
import { mediaApi } from '../../api/media'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { generateWriterCredentials } from '../../utils/credentials'
import toast from 'react-hot-toast'
import { Camera, Sparkles } from 'lucide-react'

export interface QuickWriter {
  _id: string
  name: string
  jobTitle?: string
}

interface QuickWriterModalProps {
  isOpen: boolean
  onClose: () => void
  /** When set, the modal edits this writer instead of creating a new one */
  writer?: UserRecord | null
  /** Called with the created/updated writer so the caller can select or refresh */
  onCreated: (writer: QuickWriter) => void
}

/**
 * Compact writer-profile dialog (create + edit) used by the article editor
 * and the «الكُتّاب» page. Writers are signature-only profiles
 * (name + photo + bio) with auto-generated credentials — they never log in.
 */
export default function QuickWriterModal({ isOpen, onClose, writer, onCreated }: QuickWriterModalProps) {
  const isEdit = !!writer
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Prefill on open (edit) / reset (create)
  useEffect(() => {
    if (!isOpen) return
    setName(writer?.name ?? '')
    setJobTitle(writer?.jobTitle ?? '')
    setBio(writer?.bio ?? '')
    setAvatarUrl((typeof writer?.avatar === 'object' ? writer?.avatar?.url : writer?.avatar) ?? '')
  }, [isOpen, writer])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const res = await mediaApi.upload(fd)
      const asset = res.data?.data
      const url = asset?.secure_url || asset?.url
      if (url) setAvatarUrl(url)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في رفع الصورة')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (name.trim().length < 2) { toast.error('يرجى إدخال اسم الكاتب'); return }
    setSaving(true)
    try {
      if (isEdit && writer) {
        const id = writer.id || (writer as any)._id
        const res = await usersApi.update(id, {
          name: name.trim(),
          jobTitle: jobTitle.trim(),
          bio: bio.trim(),
          avatar: avatarUrl ? { url: avatarUrl } : null,
        })
        const u = res.data?.data || {}
        toast.success('تم تحديث ملف الكاتب')
        onCreated({ _id: u.id || u._id || id, name: u.name || name.trim(), jobTitle: u.jobTitle })
      } else {
        const creds = generateWriterCredentials(name)
        const res = await usersApi.create({
          name: name.trim(),
          email: creds.email,
          password: creds.password,
          role: 'author',
          jobTitle: jobTitle.trim() || undefined,
          bio: bio.trim() || undefined,
          avatar: avatarUrl ? { url: avatarUrl } : undefined,
          isProfileOnly: true,
        })
        const u = res.data?.data || {}
        toast.success(`تم إنشاء ملف الكاتب «${name.trim()}»`)
        onCreated({ _id: u.id || u._id, name: u.name || name.trim(), jobTitle: u.jobTitle })
      }
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في حفظ الكاتب')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'تعديل الكاتب' : 'إضافة كاتب جديد'}>
      <div className="space-y-4">
        {/* Avatar + name row */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative shrink-0 group"
            title="صورة الكاتب"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover ring-2 ring-gold-400/70" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-ink-900 flex items-center justify-center text-gold-300 text-xl font-bold font-heading">
                {name.trim().charAt(0) || 'ك'}
              </div>
            )}
            <span className="absolute bottom-0 left-0 p-1 bg-gold-500 text-ink-950 rounded-full shadow group-hover:bg-gold-400 transition-colors">
              <Camera className="w-3.5 h-3.5" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
          />
          <div className="flex-1">
            <label className="label-base">اسم الكاتب</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: غادة السمّان"
              className="input-base text-sm"
              autoFocus={!isEdit}
            />
          </div>
        </div>
        {uploading && <p className="text-xs text-gold-600">جارِ رفع الصورة...</p>}

        <div>
          <label className="label-base">المسمى الوظيفي (اختياري)</label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="مثال: كاتبة وروائية"
            className="input-base text-sm"
          />
        </div>

        <div>
          <label className="label-base">نبذة تعريفية (اختياري)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="نبذة قصيرة تظهر في صفحة الكاتب..."
            className="input-base text-sm resize-none"
          />
        </div>

        {!isEdit && (
          <p className="flex items-start gap-1.5 text-xs text-gray-400 leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 text-gold-500 shrink-0 mt-0.5" />
            ملف توقيع فقط — لا يسجّل الكاتب دخوله ولا يظهر ضمن فريق التحرير. تُنشر المقالات باسمه وتظهر في صفحته على الموقع.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="gold" onClick={handleSave} isLoading={saving || uploading} className="flex-1">
            {isEdit ? 'حفظ التعديلات' : 'إنشاء الكاتب'}
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">إلغاء</Button>
        </div>
      </div>
    </Modal>
  )
}
