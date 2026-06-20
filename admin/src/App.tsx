import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import AdminLayout from './components/layout/AdminLayout'

// Lazy load pages for code-splitting
const Login            = lazy(() => import('./pages/Login'))
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const ArticleList      = lazy(() => import('./pages/articles/ArticleList'))
const ArticleEditor    = lazy(() => import('./pages/articles/ArticleEditor'))
const ArticleRevisions = lazy(() => import('./pages/articles/ArticleRevisions'))
const CategoryManager  = lazy(() => import('./pages/categories/CategoryManager'))
const HomepageControl  = lazy(() => import('./pages/homepage/HomepageControl'))
const UserManager      = lazy(() => import('./pages/users/UserManager'))
const CommentModeration= lazy(() => import('./pages/comments/CommentModeration'))
const TickerManager    = lazy(() => import('./pages/tickers/TickerManager'))
const MediaLibrary     = lazy(() => import('./pages/media/MediaLibrary'))
const SiteSettings     = lazy(() => import('./pages/settings/SiteSettings'))
const ContentCalendar  = lazy(() => import('./pages/calendar/ContentCalendar'))
const ReviewQueue      = lazy(() => import('./pages/review/ReviewQueue'))
const Profile          = lazy(() => import('./pages/profile/Profile'))

// Branded suspense fallback — the telegraph key tapping while pages load
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark">
      <div className="flex flex-col items-center gap-4">
        <span className="font-display text-4xl gold-foil leading-tight">التلغراف</span>
        <div className="morse-loader" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 tracking-widest">جارٍ التحميل…</p>
      </div>
    </div>
  )
}

// Auth guard: redirects to /login if not authenticated
function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

// Permission guard: redirects to /dashboard when the account lacks the privilege
function PermissionGuard({ permission }: { permission: Parameters<ReturnType<typeof useAuthStore.getState>['can']>[0] }) {
  const can = useAuthStore((s) => s.can)
  if (!can(permission)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Public guard: redirects to /dashboard if already authenticated
function PublicGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  const darkMode = useUIStore((s) => s.darkMode)

  return (
    <div className={darkMode ? 'dark' : ''}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicGuard />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Protected routes */}
            <Route element={<AuthGuard />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"            element={<Dashboard />} />
                <Route path="/articles"             element={<ArticleList />} />
                <Route path="/articles/new"         element={<ArticleEditor />} />
                <Route path="/articles/:id/edit"    element={<ArticleEditor />} />
                <Route path="/articles/:id/revisions" element={<ArticleRevisions />} />
                <Route path="/profile"              element={<Profile />} />
                <Route element={<PermissionGuard permission="articles.publish" />}>
                  <Route path="/review"             element={<ReviewQueue />} />
                </Route>
                <Route element={<PermissionGuard permission="categories.manage" />}>
                  <Route path="/categories"         element={<CategoryManager />} />
                </Route>
                <Route element={<PermissionGuard permission="homepage.manage" />}>
                  <Route path="/homepage"           element={<HomepageControl />} />
                </Route>
                <Route element={<PermissionGuard permission="users.manage" />}>
                  <Route path="/users"              element={<UserManager />} />
                </Route>
                <Route element={<PermissionGuard permission="comments.moderate" />}>
                  <Route path="/comments"           element={<CommentModeration />} />
                </Route>
                <Route element={<PermissionGuard permission="tickers.manage" />}>
                  <Route path="/tickers"            element={<TickerManager />} />
                </Route>
                <Route element={<PermissionGuard permission="media.manage" />}>
                  <Route path="/media"              element={<MediaLibrary />} />
                </Route>
                <Route element={<PermissionGuard permission="settings.manage" />}>
                  <Route path="/settings"           element={<SiteSettings />} />
                </Route>
                <Route element={<PermissionGuard permission="articles.editAll" />}>
                  <Route path="/calendar"           element={<ContentCalendar />} />
                </Route>
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            direction: 'rtl',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            // CSS variables resolve per theme, so toasts follow dark mode
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          },
          success: { iconTheme: { primary: '#b8923d', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#c63a30', secondary: '#fff' } },
        }}
      />
    </div>
  )
}
