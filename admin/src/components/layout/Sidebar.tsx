import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, FileText, FolderOpen, Home, Users, MessageSquare,
  Radio, Image, Calendar, Settings, LogOut, ChevronRight, ChevronLeft,
  ClipboardCheck, UserCircle,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore, PermissionKey } from '../../store/authStore'
import { apiClient } from '../../api/client'
import toast from 'react-hot-toast'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  permission?: PermissionKey
  badge?: number
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المدير الأعلى',
  admin: 'مدير',
  editor: 'محرر',
  author: 'كاتب',
  reader: 'قارئ',
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout, can } = useAuthStore()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)

  const canPublish = can('articles.publish')

  // Pending review badge for editors
  useEffect(() => {
    if (!canPublish) return
    let cancelled = false
    const fetchCount = async () => {
      try {
        const res = await apiClient.get('/articles/pending-count')
        if (!cancelled) setPendingCount(res.data?.data?.count ?? 0)
      } catch { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [canPublish])

  const navItems: NavItem[] = [
    { to: '/dashboard',  icon: <LayoutDashboard className="w-5 h-5" />, label: 'لوحة التحكم' },
    { to: '/articles',   icon: <FileText className="w-5 h-5" />,        label: 'المقالات', permission: 'articles.create' },
    { to: '/review',     icon: <ClipboardCheck className="w-5 h-5" />,  label: 'قائمة المراجعة', permission: 'articles.publish', badge: pendingCount },
    { to: '/categories', icon: <FolderOpen className="w-5 h-5" />,      label: 'التصنيفات', permission: 'categories.manage' },
    { to: '/homepage',   icon: <Home className="w-5 h-5" />,            label: 'الصفحة الرئيسية', permission: 'homepage.manage' },
    { to: '/users',      icon: <Users className="w-5 h-5" />,           label: 'فريق التحرير', permission: 'users.manage' },
    { to: '/comments',   icon: <MessageSquare className="w-5 h-5" />,   label: 'التعليقات', permission: 'comments.moderate' },
    { to: '/tickers',    icon: <Radio className="w-5 h-5" />,           label: 'الشريط الإخباري', permission: 'tickers.manage' },
    { to: '/media',      icon: <Image className="w-5 h-5" />,           label: 'مكتبة الوسائط', permission: 'media.manage' },
    { to: '/calendar',   icon: <Calendar className="w-5 h-5" />,        label: 'التقويم', permission: 'articles.editAll' },
    { to: '/profile',    icon: <UserCircle className="w-5 h-5" />,      label: 'ملفي الشخصي' },
    { to: '/settings',   icon: <Settings className="w-5 h-5" />,        label: 'الإعدادات', permission: 'settings.manage' },
  ]

  const visibleItems = navItems.filter((item) => !item.permission || can(item.permission))

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
      toast.success('تم تسجيل الخروج بنجاح')
    } catch {
      navigate('/login')
    }
  }

  const avatarUrl = typeof user?.avatar === 'object' ? user?.avatar?.url : user?.avatar

  return (
    <aside
      className={clsx(
        'fixed top-0 right-0 h-screen flex flex-col z-40',
        'bg-gray-900 text-gray-300 transition-all duration-300 ease-in-out',
        'border-l border-gold-900/40',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
      dir="rtl"
    >
      {/* Masthead */}
      <div className={clsx(
        'flex flex-col border-b border-white/10 flex-shrink-0',
        sidebarCollapsed ? 'items-center py-4 px-2' : 'px-4 pt-5 pb-4'
      )}>
        {sidebarCollapsed ? (
          <span className="font-display text-2xl gold-foil leading-none">ت</span>
        ) : (
          <>
            <span className="font-display text-3xl gold-foil leading-tight text-center">التلغراف</span>
            <p className="text-gray-500 text-[11px] tracking-widest text-center mt-1">لوحة التحكم</p>
            <div className="morse-line morse-line--subtle morse-line--animated mt-3" />
          </>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -left-3 top-20 w-6 h-6 bg-gray-900 border border-gold-700/50 rounded-full flex items-center justify-center text-gold-400 hover:text-gold-200 transition-colors shadow"
        title={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
      >
        {sidebarCollapsed ? (
          <ChevronLeft className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={sidebarCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-md transition-all duration-150 group relative',
                sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-gold-500 text-ink-950 font-semibold shadow-gold/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gold-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex-shrink-0">
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={clsx(
                      'flex-shrink-0 min-w-[1.25rem] h-5 rounded-full text-xs font-bold flex items-center justify-center px-1',
                      isActive
                        ? 'bg-ink-950 text-gold-300'
                        : 'bg-gold-500 text-ink-950',
                      sidebarCollapsed ? 'absolute -top-1 -left-1' : 'mr-auto'
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {/* Tooltip for collapsed */}
                {sidebarCollapsed && (
                  <div className="absolute right-full ml-3 mr-3 px-2 py-1 bg-gray-950 border border-gold-900/50 text-gold-100 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-2 flex-shrink-0">
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-gold-500/60 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-ink-950 text-sm font-bold flex-shrink-0">
                {user.name?.charAt(0) ?? 'م'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-gold-400/80 truncate">{user.jobTitle || ROLE_LABELS[user.role] || user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? 'تسجيل الخروج' : undefined}
          className={clsx(
            'w-full flex items-center rounded-md text-gray-400 hover:bg-red-900/30 hover:text-red-300 transition-all duration-150',
            sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm font-medium">تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  )
}
