import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { Eye, Users, CalendarDays, TrendingUp } from 'lucide-react'
import { analyticsApi, type RangePreset } from '../../api/analytics'
import { KpiCard } from '../ui/KpiCard'
import { Skeleton } from '../ui/Skeleton'
import { formatDate } from '../../utils/dateUtils'

// recharts is heavy — split it out so the dashboard paints immediately
const ViewsChart = lazy(() => import('../charts/ViewsChart'))

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: '٧ أيام' },
  { value: '30d', label: '٣٠ يوماً' },
  { value: '90d', label: '٩٠ يوماً' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'year', label: 'هذه السنة' },
  { value: 'all', label: 'منذ الإطلاق' },
]

interface RangeData {
  from: string
  to: string
  today: string
  totals: {
    views: number
    visitors: number | null
    avgPerDay: number
    peak: { date: string; views: number } | null
  }
  series: { date: string; views: number; visitors: number | null }[]
  topArticles: { _id: string; title: string; views: number; category?: { name: string } }[]
  categories: { _id: string; name: string; color?: string; views: number }[]
  history: { since: string; visitorsSince: string | null; lifetimeViews: number }
}

type Params = { preset?: RangePreset; from?: string; to?: string }

/**
 * Readership for any period: views, visitors, the day-by-day line, and what
 * was read most. Finished days come from the permanent daily record; today is
 * live. The footnote says how far back that record reaches, because before it
 * the raw logs had already expired and only the lifetime total survives.
 */
export default function VisitorStats({ formatNumber }: { formatNumber: (n: number) => string }) {
  const [preset, setPreset] = useState<RangePreset | 'custom'>('30d')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [data, setData] = useState<RangeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // Only the latest request may land — quick clicks across presets must not
  // leave an older, slower answer on screen.
  const latest = useRef(0)

  const load = (params: Params) => {
    const ticket = ++latest.current
    setLoading(true)
    setFailed(false)
    analyticsApi.range(params)
      .then((res) => { if (ticket === latest.current) setData(res.data?.data ?? null) })
      .catch(() => { if (ticket === latest.current) setFailed(true) })
      .finally(() => { if (ticket === latest.current) setLoading(false) })
  }

  useEffect(() => {
    if (preset !== 'custom') load({ preset })
  }, [preset])

  const openCustom = () => {
    setPreset('custom')
    if (data) setCustom({ from: data.from, to: data.to })
  }

  const customValid = Boolean(custom.from && custom.to && custom.from <= custom.to)

  const t = data?.totals
  const kpis = [
    { title: 'المشاهدات', value: t?.views ?? 0, icon: <Eye className="w-5 h-5" />, color: 'gold' as const },
    { title: 'الزوار', value: t?.visitors ?? '—', icon: <Users className="w-5 h-5" />, color: 'ink' as const },
    { title: 'المتوسط اليومي', value: t?.avgPerDay ?? 0, icon: <CalendarDays className="w-5 h-5" />, color: 'blue' as const },
    {
      title: 'أعلى يوم',
      value: t?.peak?.views ?? '—',
      suffix: t?.peak ? `· ${formatDate(t.peak.date, 'd MMMM')}` : undefined,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'green' as const,
    },
  ]

  const topCategory = data?.categories[0]?.views || 0

  return (
    <section className="card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-gray-900 dark:text-gray-100">إحصاءات القرّاء</h2>
          {data && (
            <p className="text-xs text-gray-500 mt-1">
              {data.from === data.to
                ? formatDate(data.from)
                : `من ${formatDate(data.from)} إلى ${formatDate(data.to)}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="الفترة">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                preset === p.value
                  ? 'bg-gold-500 border-gold-600 text-ink-950'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gold-300'
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={openCustom}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              preset === 'custom'
                ? 'bg-gold-500 border-gold-600 text-ink-950'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gold-300'
            )}
          >
            فترة مخصّصة
          </button>
        </div>
      </div>

      {preset === 'custom' && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (customValid) load(custom) }}
        >
          <label className="text-xs text-gray-500">
            من
            <input
              type="date"
              dir="ltr"
              className="input-base mt-1 w-40"
              value={custom.from}
              max={data?.today}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
          </label>
          <label className="text-xs text-gray-500">
            إلى
            <input
              type="date"
              dir="ltr"
              className="input-base mt-1 w-40"
              value={custom.to}
              max={data?.today}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-gold text-sm" disabled={!customValid}>عرض</button>
        </form>
      )}

      {failed ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-red-500">
          تعذّر تحميل الإحصاءات — حاول مرة أخرى
        </div>
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
          </div>
          <Skeleton className="h-[220px] rounded-md" />
        </div>
      ) : data && (
        <div className={clsx('space-y-5 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">يوماً بيوم</h3>
            {data.series.some((d) => d.views > 0) ? (
              <Suspense fallback={<Skeleton className="h-[220px] rounded-md" />}>
                <ViewsChart data={data.series} formatNumber={formatNumber} />
              </Suspense>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                لا توجد مشاهدات في هذه الفترة
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">الأكثر قراءة في الفترة</h3>
              {data.topArticles.length > 0 ? (
                <ol className="space-y-2.5">
                  {data.topArticles.map((a, i) => (
                    <li key={a._id} className="flex items-start gap-3 group">
                      <span className="w-5 text-sm font-bold text-gold-600 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/articles/${a._id}/edit`}
                          className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-gold-700 dark:group-hover:text-gold-300 transition-colors"
                        >
                          {a.title}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.views.toLocaleString('ar')} مشاهدة
                          {a.category?.name && ` · ${a.category.name}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-400">لا توجد مشاهدات في هذه الفترة</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">حسب القسم</h3>
              {data.categories.length > 0 ? (
                <ul className="space-y-2.5">
                  {data.categories.slice(0, 8).map((c) => (
                    <li key={c._id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{c.name}</span>
                        <span className="text-gray-400">{c.views.toLocaleString('ar')}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${topCategory ? Math.max(2, (c.views / topCategory) * 100) : 0}%`,
                            background: c.color || '#b8923d',
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">لا توجد مشاهدات في هذه الفترة</p>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
            <p>
              إجمالي المشاهدات منذ إطلاق الموقع:{' '}
              <strong className="text-gray-700 dark:text-gray-300">{data.history.lifetimeViews.toLocaleString('ar')}</strong>
            </p>
            <p>
              السجل اليومي محفوظ منذ {formatDate(data.history.since)}؛ الأيام التي قبله حُذفت من السجلات قبل حفظها،
              لذا يبدأ الرسم البياني من هذا التاريخ.
            </p>
            <p>
              {data.history.visitorsSince
                ? `يُحتسب الزوار منذ ${formatDate(data.history.visitorsSince)}، والزائر يُعدّ مرة واحدة في كل يوم يزور فيه الموقع.`
                : 'بدأ عدّ الزوار مع هذا التحديث، وستظهر أرقامهم مع أول القرّاء.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
