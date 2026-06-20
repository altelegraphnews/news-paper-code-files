import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { KpiCard } from '../components/ui/KpiCard'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import {
  FileText, Eye, MessageSquare, PenLine,
  ClipboardCheck, CheckCircle2, FileEdit,
  Users, Image as ImageIcon, Settings,
} from 'lucide-react'
import { timeAgo } from '../utils/dateUtils'

// recharts is heavy — split it out so the dashboard paints immediately
const ViewsChart = lazy(() => import('../components/charts/ViewsChart'))

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'م'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'ك'
  return n.toLocaleString('ar')
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold' }> = {
  draft:     { label: 'مسودة', variant: 'default' },
  pending:   { label: 'بانتظار المراجعة', variant: 'gold' },
  rejected:  { label: 'أُعيد مع ملاحظات', variant: 'danger' },
  scheduled: { label: 'مجدول', variant: 'info' },
  published: { label: 'منشور', variant: 'success' },
  archived:  { label: 'مؤرشف', variant: 'default' },
}

/* ─────────────────────────────────────────────
   Writer dashboard — personal stats over own articles
   ───────────────────────────────────────────── */
function WriterDashboard() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient.get('/analytics/me')
      .then((res) => setData(res.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    )
  }

  const sc = data?.statusCounts || {}

  const kpis = [
    { title: 'مقالاتي المنشورة', value: formatNumber(sc.published || 0), icon: <CheckCircle2 className="w-5 h-5" />, color: 'green' as const },
    { title: 'بانتظار المراجعة', value: formatNumber(sc.pending || 0), icon: <ClipboardCheck className="w-5 h-5" />, color: 'gold' as const },
    { title: 'مسودات', value: formatNumber((sc.draft || 0) + (sc.rejected || 0)), icon: <FileEdit className="w-5 h-5" />, color: 'ink' as const },
    { title: 'إجمالي المشاهدات', value: formatNumber(data?.totalViews || 0), icon: <Eye className="w-5 h-5" />, color: 'blue' as const },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100">
            أهلاً {user?.name?.split(' ')[0] ?? ''} ✦
          </h1>
          <p className="text-sm text-gray-500 mt-1">هذه نظرة سريعة على نشاطك في التلغراف</p>
        </div>
        <Link
          to="/articles/new"
          className="btn-gold flex items-center gap-2 text-sm"
        >
          <PenLine className="w-4 h-4" /> مقال جديد
        </Link>
      </div>

      <div className="morse-line morse-line--subtle morse-line--animated" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.title} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent articles + review status */}
        <div className="card p-5">
          <h2 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-4">آخر مقالاتي</h2>
          {(data?.recent ?? []).length > 0 ? (
            <ul className="space-y-3">
              {data.recent.map((a: any) => (
                <li key={a._id} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700/60 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/articles/${a._id}/edit`}
                      className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1 hover:text-gold-700 dark:hover:text-gold-300 transition-colors"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">
                      {a.category?.name ? `${a.category.name} · ` : ''}{timeAgo(a.updatedAt)}
                    </p>
                    {a.status === 'rejected' && a.review?.note && (
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                        ملاحظة المحرر: {a.review.note}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_BADGE[a.status]?.variant ?? 'default'} size="sm">
                    {STATUS_BADGE[a.status]?.label ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <PenLine className="w-8 h-8 opacity-40" />
              <p>لم تكتب أي مقال بعد — ابدأ الآن</p>
            </div>
          )}
        </div>

        {/* Top articles by views */}
        <div className="card p-5">
          <h2 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-4">الأكثر قراءة من مقالاتي</h2>
          {(data?.topArticles ?? []).length > 0 ? (
            <ol className="space-y-3">
              {data.topArticles.map((article: any, i: number) => (
                <li key={article._id} className="flex items-start gap-3 group">
                  <span
                    className="font-heading text-3xl font-bold leading-none w-8 flex-shrink-0 text-transparent"
                    style={{ WebkitTextStroke: '1.2px rgba(184, 146, 61, 0.75)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(article.views?.total || 0).toLocaleString('ar')} مشاهدة
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              ستظهر هنا مقالاتك الأكثر قراءة بعد النشر
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Editorial dashboard — site-wide stats
   ───────────────────────────────────────────── */
function EditorialDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [viewsData, setViewsData] = useState<any[]>([])
  const [trending, setTrending] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, trendRes, viewsRes, pendingRes] = await Promise.all([
          analyticsApi.overview().catch(() => ({ data: { data: {} } })),
          analyticsApi.trending(8).catch(() => ({ data: { data: [] } })),
          analyticsApi.views('30d').catch(() => ({ data: { data: [] } })),
          apiClient.get('/articles/pending-count').catch(() => ({ data: { data: { count: 0 } } })),
        ])

        const dash = dashRes.data?.data || {}
        setStats(dash.stats || dash)
        setViewsData(Array.isArray(viewsRes.data?.data) ? viewsRes.data.data : (dash.viewsOverTime || []))
        setTrending(Array.isArray(trendRes.data?.data) ? trendRes.data.data : [])
        setPendingCount(pendingRes.data?.data?.count ?? 0)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
        <Skeleton className="h-64 rounded-md" />
      </div>
    )
  }

  const kpis = [
    {
      title: 'إجمالي المقالات',
      value: formatNumber(stats?.articles?.total || 0),
      icon: <FileText className="w-5 h-5" />,
      color: 'ink' as const,
    },
    {
      title: 'مشاهدات اليوم',
      value: formatNumber(stats?.views?.today || 0),
      icon: <Eye className="w-5 h-5" />,
      color: 'gold' as const,
    },
    {
      title: 'مقالات بانتظار المراجعة',
      value: formatNumber(pendingCount),
      icon: <ClipboardCheck className="w-5 h-5" />,
      color: (pendingCount > 0 ? 'red' : 'green') as 'red' | 'green',
    },
    {
      title: 'تعليقات معلّقة',
      value: formatNumber(stats?.comments?.pending || 0),
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'purple' as const,
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Page title */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-gray-100">غرفة التحرير</h1>
          <p className="text-sm text-gray-500 mt-1">نبض التلغراف اليوم</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Link to="/review" className="btn-secondary flex items-center gap-2 text-sm">
              <ClipboardCheck className="w-4 h-4 text-gold-600" />
              {pendingCount} بانتظار المراجعة
            </Link>
          )}
          <Link to="/articles/new" className="btn-gold flex items-center gap-2 text-sm">
            <PenLine className="w-4 h-4" /> مقال جديد
          </Link>
        </div>
      </div>

      <div className="morse-line morse-line--subtle morse-line--animated" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.title} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views over time */}
        <div className="card p-5">
          <h2 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-4">المشاهدات خلال 30 يوماً</h2>
          {viewsData.length > 0 ? (
            <Suspense fallback={<Skeleton className="h-[220px] rounded-md" />}>
              <ViewsChart data={viewsData} formatNumber={formatNumber} />
            </Suspense>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              لا توجد بيانات بعد
            </div>
          )}
        </div>

        {/* Trending articles */}
        <div className="card p-5">
          <h2 className="font-heading font-bold text-gray-900 dark:text-gray-100 mb-4">الأكثر قراءة</h2>
          {trending.length > 0 ? (
            <ol className="space-y-3">
              {trending.slice(0, 7).map((article: any, i: number) => (
                <li key={article._id} className="flex items-start gap-3 group">
                  <span
                    className="font-heading text-3xl font-bold leading-none w-8 flex-shrink-0 text-transparent group-hover:text-gold-500 transition-colors"
                    style={{ WebkitTextStroke: '1.2px rgba(184, 146, 61, 0.75)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/articles/${article._id}/edit`}
                      className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-gold-700 dark:group-hover:text-gold-300 transition-colors"
                    >
                      {article.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(article.views?.total || 0).toLocaleString('ar')} مشاهدة
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              لا توجد بيانات بعد
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'المقالات', href: '/articles', icon: FileText },
          { label: 'قائمة المراجعة', href: '/review', icon: ClipboardCheck },
          { label: 'فريق التحرير', href: '/users', icon: Users },
          { label: 'التعليقات', href: '/comments', icon: MessageSquare },
          { label: 'الوسائط', href: '/media', icon: ImageIcon },
          { label: 'الإعدادات', href: '/settings', icon: Settings },
        ].map((item, i) => (
          <Link
            key={item.href}
            to={item.href}
            className="card hover-lift rise flex flex-col items-center gap-2.5 p-4 hover:border-gold-300 group"
            style={{ animationDelay: `${300 + i * 60}ms` }}
          >
            <span className="w-10 h-10 rounded-full bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <item.icon className="w-5 h-5 text-gold-600 dark:text-gold-300" />
            </span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gold-700 dark:group-hover:text-gold-300 transition-colors">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const can = useAuthStore((s) => s.can)
  return can('analytics.view') ? <EditorialDashboard /> : <WriterDashboard />
}
