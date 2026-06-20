import { useAuthStore, PermissionKey } from '../store/authStore'

export function useAuth() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login           = useAuthStore((s) => s.login)
  const logout          = useAuthStore((s) => s.logout)
  const can             = useAuthStore((s) => s.can)

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false
    if (Array.isArray(role)) return role.includes(user.role)
    return user.role === role
  }

  const isAdmin  = user?.role === 'admin' || user?.role === 'super_admin'
  const isEditor = user?.role === 'editor' || isAdmin
  const isWriter = user?.role === 'author'

  return { user, isAuthenticated, login, logout, hasRole, can, isAdmin, isEditor, isWriter }
}

export type { PermissionKey }
