import { useEffect, useState } from 'react'
import { homepageApi, type HomepageSettings as Settings } from '../../api/homepage'
import { categoriesApi } from '../../api/categories'
import { mediaApi } from '../../api/media'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'
import { GripVertical, Eye, EyeOff, Save, Image as ImageIcon, RotateCcw } from 'lucide-react'

const SECTION_LABELS: Record<string, string> = {
  heroFeatured: 'الواجهة والمختارات',
  latest: 'أحدث المقالات',
  categoryRows: 'أقسام التصنيفات',
  opinion: 'رأي وتحليل',
  newsletter: 'النشرة البريدية',
}

const inputClass = 'w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40'
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

export default function HomepageSettings() {
  const [s, setS] = useState<Settings | null>(null)
  const [cats, setCats] = useState<{ _id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([homepageApi.getSettings(), categoriesApi.list()])
      .then(([sr, cr]) => {
        setS(sr.data?.data)
        const list = (cr.data?.data || []).filter((c: any) => !c.parent && !c.parentId)
        setCats(list.map((c: any) => ({ _id: c._id || c.id, name: c.name })))
      })
      .catch(() => toast.error('فشل تحميل الإعدادات'))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !s) {
    return <div className="p-8 text-center text-gray-400">جارِ التحميل…</div>
  }

  const update = (patch: Partial<Settings>) => setS({ ...s, ...patch })
  const setTitle = (k: string, v: string) => update({ titles: { ...s.titles, [k]: v } })
  const setNews = (k: string, v: string) => update({ newsletter: { ...s.newsletter, [k]: v } })

  const toggleSection = (key: string) =>
    update({ sections: s.sections.map((x) => (x.key === key ? { ...x, enabled: !x.enabled } : x)) })

  const onDrop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return }
    const arr = [...s.sections]
    const from = arr.findIndex((x) => x.key === dragKey)
    const to = arr.findIndex((x) => x.key === targetKey)
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    update({ sections: arr })
    setDragKey(null)
  }

  const toggleCategoryRow = (id: string) => {
    const has = s.categoryRowIds.includes(id)
    update({ categoryRowIds: has ? s.categoryRowIds.filter((x) => x !== id) : [...s.categoryRowIds, id] })
  }

  const uploadMasthead = async (file?: File) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const res = await mediaApi.upload(fd)
      const url = res.data?.data?.secure_url || res.data?.data?.url
      if (url) update({ masthead: { ...s.masthead, imageUrl: url } })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'فشل رفع الصورة')
    } finally { setUploading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await homepageApi.saveSettings(s)
      toast.success('تم حفظ إعدادات الصفحة الرئيسية')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'فشل الحفظ')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Sections — order + visibility + titles */}
      <section className="card p-5">
        <h3 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-1">ترتيب الأقسام وظهورها</h3>
        <p className="text-xs text-gray-400 mb-4">اسحب لإعادة الترتيب، وبدّل الظهور، وعدّل العناوين.</p>
        <div className="space-y-2">
          {s.sections.map((sec) => (
            <div
              key={sec.key}
              draggable
              onDragStart={() => setDragKey(sec.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(sec.key)}
              className={`rounded-md border p-3 bg-gray-50 dark:bg-gray-800/50 ${dragKey === sec.key ? 'opacity-40' : ''} border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab shrink-0" />
                <span className="font-medium text-sm text-gray-800 dark:text-gray-100 flex-1">{SECTION_LABELS[sec.key] || sec.key}</span>
                <button
                  onClick={() => toggleSection(sec.key)}
                  className={`p-1.5 rounded-md ${sec.enabled ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  title={sec.enabled ? 'ظاهر — اضغط للإخفاء' : 'مخفي — اضغط للإظهار'}
                >
                  {sec.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {/* Inline titles per section */}
              {sec.key === 'heroFeatured' && (
                <input className={`${inputClass} mt-2`} value={s.titles.featured || ''} onChange={(e) => setTitle('featured', e.target.value)} placeholder="عنوان شريط المختارات" />
              )}
              {sec.key === 'latest' && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={inputClass} value={s.titles.latest || ''} onChange={(e) => setTitle('latest', e.target.value)} placeholder="عنوان قسم أحدث المقالات" />
                  <div className="flex items-center gap-2">
                    <input className={inputClass} value={s.titles.mostRead || ''} onChange={(e) => setTitle('mostRead', e.target.value)} placeholder="عنوان الأكثر قراءة" />
                    <button onClick={() => update({ mostReadEnabled: !s.mostReadEnabled })} className={`p-2 rounded-md shrink-0 ${s.mostReadEnabled ? 'text-green-600' : 'text-gray-400'}`} title="إظهار/إخفاء الشريط الجانبي (الأكثر قراءة)">
                      {s.mostReadEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              {sec.key === 'opinion' && (
                <input className={`${inputClass} mt-2`} value={s.titles.opinion || ''} onChange={(e) => setTitle('opinion', e.target.value)} placeholder="عنوان قسم رأي وتحليل" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Category rows */}
      <section className="card p-5">
        <h3 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-1">أقسام التصنيفات على الرئيسية</h3>
        <p className="text-xs text-gray-400 mb-4">اختر التصنيفات التي تظهر كأقسام. إن لم تختر شيئاً، تُعرَض تلقائياً.</p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => {
            const on = s.categoryRowIds.includes(c._id)
            return (
              <button
                key={c._id}
                onClick={() => toggleCategoryRow(c._id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-gold-500 text-white border-gold-500' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
              >
                {on ? `${s.categoryRowIds.indexOf(c._id) + 1}. ` : ''}{c.name}
              </button>
            )
          })}
        </div>
      </section>

      {/* Newsletter text */}
      <section className="card p-5">
        <h3 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-4">نصوص النشرة البريدية</h3>
        <div className="space-y-3">
          <div><label className={labelClass}>سطر علوي صغير</label><input className={inputClass} value={s.newsletter.kicker || ''} onChange={(e) => setNews('kicker', e.target.value)} /></div>
          <div><label className={labelClass}>العنوان</label><input className={inputClass} value={s.newsletter.heading || ''} onChange={(e) => setNews('heading', e.target.value)} /></div>
          <div><label className={labelClass}>النص</label><textarea rows={2} className={`${inputClass} resize-none`} value={s.newsletter.body || ''} onChange={(e) => setNews('body', e.target.value)} /></div>
        </div>
      </section>

      {/* Masthead */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-gray-900 dark:text-gray-100">لافتة الاسم (Masthead)</h3>
          <button onClick={() => update({ masthead: { ...s.masthead, enabled: !s.masthead.enabled } })} className={`p-1.5 rounded-md ${s.masthead.enabled ? 'text-green-600' : 'text-gray-400'}`} title="إظهار/إخفاء اللافتة">
            {s.masthead.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden mb-3" style={{ background: '#efe7d6' }}>
          <img src={s.masthead.imageUrl || '/masthead.jpg'} alt="masthead" className="w-full h-auto max-h-32 object-contain mx-auto" />
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-sm cursor-pointer hover:border-gold-400">
            <ImageIcon className="w-4 h-4 text-gold-600" />
            {uploading ? 'جارِ الرفع…' : 'رفع صورة جديدة'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { uploadMasthead(e.target.files?.[0]); e.currentTarget.value = '' }} />
          </label>
          {s.masthead.imageUrl && (
            <button onClick={() => update({ masthead: { ...s.masthead, imageUrl: '' } })} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gold-600">
              <RotateCcw className="w-3.5 h-3.5" /> استعادة الافتراضية
            </button>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="gold" onClick={save} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  )
}
