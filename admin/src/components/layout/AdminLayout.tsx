import { Outlet, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useUIStore } from '../../store/uiStore'

export default function AdminLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark" dir="rtl">
      <Sidebar />
      <Topbar />

      {/* Main content shifted left of sidebar */}
      <main
        className={clsx(
          'min-h-screen pt-16 transition-all duration-300',
          sidebarCollapsed ? 'mr-16' : 'mr-64'
        )}
      >
        {/* keyed by route so every navigation re-runs the entrance animation */}
        <div key={pathname} className="p-6 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
