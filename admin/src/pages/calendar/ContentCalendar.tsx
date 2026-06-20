import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { articlesApi } from '../../api/articles'
import { Badge } from '../../components/ui/Badge'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Calendar, RefreshCw, List, Grid,
} from 'lucide-react'
import { formatDate } from '../../utils/dateUtils'

interface CalendarArticle {
  _id: string
  title: string
  status: string
  scheduledAt?: string
  publishedAt?: string
  category?: { name: string }
  author?: { displayName?: string; name?: string }
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700',
  archived: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'مجدول',
  published: 'منشور',
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  archived: 'مؤرشف',
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []
  // padding before
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, -i + 0 - (first.getDay() - 1) + i))
  }
  // days in month
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  // padding after (to fill 6 rows)
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1))
  }
  return days
}

export default function ContentCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [articles, setArticles] = useState<CalendarArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    // Fetch articles for the visible month range
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    Promise.allSettled([
      articlesApi.list({ status: 'scheduled', limit: 100 }),
      articlesApi.list({ status: 'published', limit: 100 }),
    ]).then(([scheduledRes, publishedRes]) => {
      const scheduled = scheduledRes.status === 'fulfilled' ? scheduledRes.value.data?.data || [] : []
      const published = publishedRes.status === 'fulfilled' ? publishedRes.value.data?.data || [] : []
      setArticles([...scheduled, ...published])
    }).catch(() => toast.error('فشل في تحميل التقويم'))
    .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Map articles to day keys
  const articlesByDay = articles.reduce<Record<string, CalendarArticle[]>>((acc, article) => {
    const dateStr = article.scheduledAt || article.publishedAt
    if (!dateStr) return acc
    const d = new Date(dateStr)
    const key = getDateKey(d)
    if (!acc[key]) acc[key] = []
    acc[key].push(article)
    return acc
  }, {})

  const days = getDaysInMonth(year, month)
  const todayKey = getDateKey(today)

  // List view: articles sorted by date
  const listArticles = articles
    .filter((a) => {
      const d = new Date(a.scheduledAt || a.publishedAt || '')
      return d.getMonth() === month && d.getFullYear() === year
    })
    .sort((a, b) => {
      const da = new Date(a.scheduledAt || a.publishedAt || '').getTime()
      const db = new Date(b.scheduledAt || b.publishedAt || '').getTime()
      return da - db
    })

  const selectedArticles = selectedDay ? (articlesByDay[selectedDay] || []) : []

  return (
    <div className="p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">تقويم المحتوى</h1>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
            <button
              onClick={() => setViewMode('month')}
              className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'month' ? 'bg-surface dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-surface dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-32 text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
            className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            اليوم
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={clsx('w-2.5 h-2.5 rounded-full', {
              'bg-blue-500': k === 'scheduled',
              'bg-green-500': k === 'published',
              'bg-gray-400': k === 'draft',
              'bg-yellow-500': k === 'pending_review',
              'bg-purple-500': k === 'archived',
            })} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{v}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'month' ? (
        <div className="flex gap-5">
          {/* Calendar grid */}
          <div className="flex-1 card overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {day}
                </div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const key = getDateKey(day)
                const inMonth = day.getMonth() === month
                const isToday = key === todayKey
                const dayArticles = articlesByDay[key] || []
                const isSelected = selectedDay === key
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={clsx(
                      'min-h-[90px] p-1.5 border-b border-l border-gray-100 dark:border-gray-700/50 cursor-pointer transition-colors',
                      !inMonth && 'bg-gray-50/50 dark:bg-gray-800/20',
                      isSelected && 'bg-red-50 dark:bg-red-900/10',
                      !isSelected && inMonth && 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    )}
                  >
                    <div className={clsx(
                      'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                      isToday ? 'bg-red-600 text-white' : inMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'
                    )}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayArticles.slice(0, 3).map((article) => (
                        <div
                          key={article._id}
                          className={clsx('text-xs px-1 py-0.5 rounded truncate', STATUS_COLORS[article.status] || STATUS_COLORS.draft)}
                          title={article.title}
                        >
                          {article.title}
                        </div>
                      ))}
                      {dayArticles.length > 3 && (
                        <div className="text-xs text-gray-400 px-1">+{dayArticles.length - 3} أخرى</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDay && (
            <div className="w-72 flex-shrink-0 card overflow-hidden self-start sticky top-6">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  {formatDate(selectedDay)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedArticles.length} مقال</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-96 overflow-y-auto">
                {selectedArticles.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                    لا توجد مقالات في هذا اليوم
                  </div>
                ) : selectedArticles.map((article) => (
                  <Link
                    key={article._id}
                    to={`/articles/${article._id}/edit`}
                    className="flex items-start gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', {
                      'bg-blue-500': article.status === 'scheduled',
                      'bg-green-500': article.status === 'published',
                      'bg-gray-400': article.status === 'draft',
                      'bg-yellow-500': article.status === 'pending_review',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {article.scheduledAt
                            ? new Date(article.scheduledAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
                            : article.publishedAt
                            ? new Date(article.publishedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                        <Badge variant={article.status === 'published' ? 'success' : article.status === 'scheduled' ? 'info' : 'default'} size="sm">
                          {STATUS_LABELS[article.status] || article.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="card overflow-hidden">
          {listArticles.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد مقالات في {MONTHS[month]}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {listArticles.map((article) => {
                const dateStr = article.scheduledAt || article.publishedAt || ''
                const d = new Date(dateStr)
                return (
                  <Link
                    key={article._id}
                    to={`/articles/${article._id}/edit`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Date badge */}
                    <div className="text-center w-12 flex-shrink-0">
                      <p className="text-xs text-gray-400">{WEEKDAYS[d.getDay()]}</p>
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight">{d.getDate()}</p>
                      <p className="text-xs text-gray-400">
                        {d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={clsx('w-1 self-stretch rounded-full flex-shrink-0', {
                      'bg-blue-500': article.status === 'scheduled',
                      'bg-green-500': article.status === 'published',
                      'bg-gray-300': article.status === 'draft',
                      'bg-yellow-500': article.status === 'pending_review',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {article.category && (
                          <span className="text-xs text-gray-400">{article.category.name}</span>
                        )}
                        {article.author && (
                          <span className="text-xs text-gray-400">· {article.author.displayName || article.author.name}</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={article.status === 'published' ? 'success' : article.status === 'scheduled' ? 'info' : article.status === 'pending_review' ? 'warning' : 'default'}
                    >
                      {STATUS_LABELS[article.status] || article.status}
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
