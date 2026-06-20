import { useState } from 'react'
import apiClient from '../../api/client'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import {
  Globe, Mail, Bell, Shield, Palette, Save,
  TestTube, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'

interface SiteSettingsForm {
  siteName: string
  siteTagline: string
  siteUrl: string
  defaultLanguage: string
  timezone: string
  articlesPerPage: number
  maintenanceMode: boolean
  maintenanceMessage: string
  allowComments: boolean
  requireCommentApproval: boolean
  allowGuestComments: boolean
  commentMaxLength: number
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpFromName: string
  pushVapidPublic: string
  pushVapidPrivate: string
  analyticsId: string
  robotsTxt: string
}

const DEFAULT: SiteSettingsForm = {
  siteName: 'التلغراف',
  siteTagline: 'مجلة أدبية وثقافية',
  siteUrl: '',
  defaultLanguage: 'ar',
  timezone: 'Asia/Riyadh',
  articlesPerPage: 20,
  maintenanceMode: false,
  maintenanceMessage: 'الموقع تحت الصيانة. يرجى المحاولة لاحقاً.',
  allowComments: true,
  requireCommentApproval: true,
  allowGuestComments: true,
  commentMaxLength: 2000,
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  smtpFromName: 'التلغراف',
  pushVapidPublic: '',
  pushVapidPrivate: '',
  analyticsId: '',
  robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: /sitemap.xml',
}

function Section({
  title, icon, defaultOpen = true, children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <span className="flex-1 text-left font-semibold text-gray-800 dark:text-gray-200">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/40'

export default function SiteSettings() {
  const [form, setForm] = useState<SiteSettingsForm>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const set = (patch: Partial<SiteSettingsForm>) => setForm((p) => ({ ...p, ...patch }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/settings', form)
      toast.success('تم حفظ الإعدادات')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    setSmtpStatus('idle')
    try {
      await apiClient.post('/api/settings/test-smtp', {
        host: form.smtpHost,
        port: Number(form.smtpPort),
        user: form.smtpUser,
        pass: form.smtpPass,
        from: form.smtpFrom,
      })
      setSmtpStatus('ok')
      toast.success('تم الاتصال بخادم البريد بنجاح')
    } catch {
      setSmtpStatus('fail')
      toast.error('فشل الاتصال بخادم البريد')
    } finally {
      setTestingSmtp(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إعدادات الموقع</h1>
        <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving}>
          <Save className="w-4 h-4 ml-1" />
          حفظ الإعدادات
        </Button>
      </div>

      {/* Maintenance alert */}
      {form.maintenanceMode && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">وضع الصيانة مفعّل</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">الموقع العام غير متاح حالياً للزوار</p>
          </div>
        </div>
      )}

      {/* General */}
      <Section title="الإعدادات العامة" icon={<Globe className="w-5 h-5" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم الموقع">
            <input value={form.siteName} onChange={(e) => set({ siteName: e.target.value })} className={inputClass} />
          </Field>
          <Field label="الشعار (Tagline)">
            <input value={form.siteTagline} onChange={(e) => set({ siteTagline: e.target.value })} className={inputClass} />
          </Field>
          <Field label="رابط الموقع" hint="المستخدم في الروابط الكنسية وخرائط المواقع">
            <input value={form.siteUrl} onChange={(e) => set({ siteUrl: e.target.value })} className={inputClass} dir="ltr" placeholder="https://altilgraf.com" />
          </Field>
          <Field label="المنطقة الزمنية">
            <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} className={inputClass}>
              <option value="Asia/Riyadh">Asia/Riyadh (AST +3)</option>
              <option value="Asia/Baghdad">Asia/Baghdad (+3)</option>
              <option value="Africa/Cairo">Africa/Cairo (+2)</option>
              <option value="Africa/Casablanca">Africa/Casablanca (+1)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <Field label="مقالات لكل صفحة">
            <input type="number" min={5} max={100} value={form.articlesPerPage} onChange={(e) => set({ articlesPerPage: Number(e.target.value) })} className={inputClass} dir="ltr" />
          </Field>
        </div>

        {/* Maintenance mode */}
        <div className="flex items-start gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex-1 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) => set({ maintenanceMode: e.target.checked })}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">تفعيل وضع الصيانة</span>
            </label>
            {form.maintenanceMode && (
              <textarea
                value={form.maintenanceMessage}
                onChange={(e) => set({ maintenanceMessage: e.target.value })}
                rows={2}
                placeholder="رسالة الصيانة للزوار..."
                className={clsx(inputClass, 'resize-none')}
              />
            )}
          </div>
        </div>
      </Section>

      {/* Comments */}
      <Section title="إعدادات التعليقات" icon={<Shield className="w-5 h-5" />}>
        <div className="space-y-3">
          {[
            { key: 'allowComments', label: 'السماح بالتعليقات على المقالات' },
            { key: 'requireCommentApproval', label: 'تعليقات تحتاج موافقة المشرف قبل النشر' },
            { key: 'allowGuestComments', label: 'السماح للزوار بالتعليق (بدون تسجيل دخول)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key as keyof SiteSettingsForm] as boolean}
                onChange={(e) => set({ [key]: e.target.checked } as any)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
          <Field label="الحد الأقصى لطول التعليق (حرف)">
            <input type="number" min={100} max={10000} value={form.commentMaxLength} onChange={(e) => set({ commentMaxLength: Number(e.target.value) })} className={clsx(inputClass, 'max-w-xs')} dir="ltr" />
          </Field>
        </div>
      </Section>

      {/* SMTP */}
      <Section title="إعدادات البريد الإلكتروني (SMTP)" icon={<Mail className="w-5 h-5" />} defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="خادم SMTP">
            <input value={form.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} className={inputClass} dir="ltr" placeholder="smtp.gmail.com" />
          </Field>
          <Field label="المنفذ">
            <input value={form.smtpPort} onChange={(e) => set({ smtpPort: e.target.value })} className={inputClass} dir="ltr" placeholder="587" />
          </Field>
          <Field label="اسم المستخدم">
            <input value={form.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} className={inputClass} dir="ltr" placeholder="user@example.com" />
          </Field>
          <Field label="كلمة المرور">
            <input type="password" value={form.smtpPass} onChange={(e) => set({ smtpPass: e.target.value })} className={inputClass} dir="ltr" />
          </Field>
          <Field label="من البريد">
            <input value={form.smtpFrom} onChange={(e) => set({ smtpFrom: e.target.value })} className={inputClass} dir="ltr" placeholder="noreply@altilgraf.com" />
          </Field>
          <Field label="اسم المرسل">
            <input value={form.smtpFromName} onChange={(e) => set({ smtpFromName: e.target.value })} className={inputClass} placeholder="التلغراف" />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleTestSmtp} isLoading={testingSmtp}>
            <TestTube className="w-4 h-4 ml-1" />
            اختبار الاتصال
          </Button>
          {smtpStatus === 'ok' && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" /> الاتصال ناجح
            </span>
          )}
          {smtpStatus === 'fail' && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" /> فشل الاتصال
            </span>
          )}
        </div>
      </Section>

      {/* Push notifications */}
      <Section title="إشعارات Push (VAPID)" icon={<Bell className="w-5 h-5" />} defaultOpen={false}>
        <Field label="VAPID Public Key">
          <input value={form.pushVapidPublic} onChange={(e) => set({ pushVapidPublic: e.target.value })} className={inputClass} dir="ltr" placeholder="BA..." />
        </Field>
        <Field label="VAPID Private Key">
          <input type="password" value={form.pushVapidPrivate} onChange={(e) => set({ pushVapidPrivate: e.target.value })} className={inputClass} dir="ltr" />
        </Field>
        <p className="text-xs text-gray-400">
          يمكن توليد مفاتيح VAPID عبر:{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">npx web-push generate-vapid-keys</code>
        </p>
      </Section>

      {/* Analytics */}
      <Section title="التحليلات والـ SEO" icon={<Palette className="w-5 h-5" />} defaultOpen={false}>
        <Field label="Google Analytics ID" hint="مثال: G-XXXXXXXXXX أو UA-XXXXXXXX">
          <input value={form.analyticsId} onChange={(e) => set({ analyticsId: e.target.value })} className={inputClass} dir="ltr" placeholder="G-XXXXXXXXXX" />
        </Field>
        <Field label="ملف robots.txt">
          <textarea
            value={form.robotsTxt}
            onChange={(e) => set({ robotsTxt: e.target.value })}
            rows={6}
            className={clsx(inputClass, 'font-mono text-xs resize-y')}
            dir="ltr"
          />
        </Field>
      </Section>

      {/* Save bottom */}
      <div className="flex justify-end pt-2">
        <Button variant="primary" onClick={handleSave} isLoading={saving}>
          <Save className="w-4 h-4 ml-1" />
          حفظ جميع الإعدادات
        </Button>
      </div>
    </div>
  )
}
