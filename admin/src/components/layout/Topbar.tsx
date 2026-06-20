import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Bell, Moon, Sun, Search, Menu, ChevronDown,
  User, LogOut, ClipboardCheck, CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../api/client'
import toast from 'react-hot-toast'
import { timeAgo } from '../../utils/dateUtils'

interface Notification {
  id: string
  icon: 'pending' | 'approved' | 'rejected'
  title: string
  message: string
  link: string
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المدير الأعلى',
  admin: 'مدير',
  editor: 'محرر',
  author: 'كاتب',
  reader: 'قارئ',
}

export default function Topbar() {
  const { sidebarCollapsed, toggleSidebar, darkMode, toggleDarkMode } = useUIStore()
  const { user, logout, can } = useAuthStore()
  const navigate = useNavigate()

  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef  = useRef<HTMLDivElement>(null)

  const canPublish = can('articles.publish')

  // Real notifications: pending submissions for editors, review outcomes for writers
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        if (canPublish) {
          const res = await apiClient.get('/articles', { params: { status: 'pending', limit: 5, sort: '-createdAt' } })
          const items = (res.data?.data ?? []) as any[]
          if (!cancelled) {
            setNotifications(items.map((a) => ({
              id: a._id,
              icon: 'pending' as const,
              title: 'مقال بانتظار المراجعة',
              message: `${a.author?.name ?? 'كاتب'} — ${a.title}`,
              link: '/review',
              createdAt: a.review?.submittedAt ?? a.updatedAt ?? a.createdAt,
            })))
          }
        } else {
          const res = await apiClient.get('/articles', { params: { mine: 'true', limit: 20, sort: '-createdAt' } })
          const items = ((res.data?.data ?? []) as any[])
            .filter((a) => a.review?.reviewedAt && ['published', 'rejected'].includes(a.status))
            .slice(0, 5)
          if (!cancelled) {
            setNotifications(items.map((a) => ({
              id: a._id,
              icon: a.status === 'published' ? 'approved' as const : 'rejected' as const,
              title: a.status === 'published' ? 'تم نشر مقالك' : 'أُعيد مقالك مع ملاحظات',
              message: a.title,
              link: a.status === 'published' ? '/articles' : `/articles/${a._id}/edit`,
              createdAt: a.review.reviewedAt,
            })))
          }
        }
      } catch { /* silent */ }
    }
    load()
    const interval = setInterval(load, 90_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [canPublish])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
      toast.success('تم تسجيل الخروج بنجاح')
    } catch {
      navigate('/login')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/articles?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const avatarUrl = typeof user?.avatar === 'object' ? user?.avatar?.url : user?.avatar

  const notifIcon = (icon: Notification['icon']) => {
    switch (icon) {
      case 'pending':  return <ClipboardCheck className="w-4 h-4 text-gold-600" />
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'rejected': return <XCircle className="w-4 h-4 text-red-600" />
    }
  }

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 h-16 z-30 flex items-center',
        'bg-surface/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700',
        'transition-all duration-300',
        sidebarCollapsed ? 'right-16' : 'right-64'
      )}
      dir="rtl"
    >
      <div className="flex items-center justify-between w-full px-4">
        {/* Right side: hamburger + search */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="تبديل القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 w-64 focus-within:border-gold-400 transition-colors">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في المقالات..."
              dir="rtl"
              className="bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none w-full"
            />
          </form>
        </div>

        {/* Left side: site link, dark mode, notifications, user */}
        <div className="flex items-center gap-2">
          {/* View site */}
          <a
            href={import.meta.env.VITE_SITE_URL || 'http://localhost:3000'}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gold-700 dark:text-gold-300 border border-gold-300/60 dark:border-gold-700 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            عرض الصحيفة
          </a>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="الإشعارات"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 left-1.5 w-4 h-4 bg-gold-500 text-ink-950 text-[10px] rounded-full flex items-center justify-center font-bold">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute left-0 top-12 w-80 bg-surface dark:bg-gray-800 rounded-md shadow-card-hover border border-gray-200 dark:border-gray-700 z-50 animate-slide-in overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {canPublish ? 'بانتظار المراجعة' : 'آخر المستجدات'}
                  </h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">لا توجد إشعارات</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        to={n.link}
                        onClick={() => setShowNotifications(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <span className="flex-shrink-0 mt-0.5">{notifIcon(n.icon)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={userRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-gold-400/70" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-ink-900 dark:bg-gold-500 flex items-center justify-center text-gold-300 dark:text-ink-950 text-sm font-bold">
                  {user?.name?.charAt(0) ?? 'م'}
                </div>
              )}
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">{user?.name ?? 'المستخدم'}</p>
                <p className="text-xs text-gold-700 dark:text-gold-400">{user?.jobTitle || ROLE_LABELS[user?.role ?? ''] || ''}</p>
              </div>
              <ChevronDown className={clsx('w-4 h-4 text-gray-500 transition-transform', showUserMenu && 'rotate-180')} />
            </button>

            {showUserMenu && (
              <div className="absolute left-0 top-12 w-52 bg-surface dark:bg-gray-800 rounded-md shadow-card-hover border border-gray-200 dark:border-gray-700 z-50 py-1 animate-slide-in">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  الملف الشخصي
                </Link>
                <hr className="my-1 border-gray-100 dark:border-gray-700" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
