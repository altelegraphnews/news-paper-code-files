import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '../api/client'

export type PermissionKey =
  | 'articles.create'
  | 'articles.editOwn'
  | 'articles.editAll'
  | 'articles.publish'
  | 'articles.delete'
  | 'articles.feature'
  | 'comments.moderate'
  | 'categories.manage'
  | 'media.upload'
  | 'media.manage'
  | 'tickers.manage'
  | 'homepage.manage'
  | 'notifications.send'
  | 'users.manage'
  | 'analytics.view'
  | 'settings.manage'

export type Permissions = Record<PermissionKey, boolean>

export interface User {
  id: string
  _id?: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'author' | 'reader' | 'super_admin'
  avatar?: { url?: string } | string
  jobTitle?: string
  bio?: string
  permissions?: Permissions
  createdAt: string
}

interface AuthStore {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  setUser: (user: User) => void
  can: (key: PermissionKey) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const res = await apiClient.post('/auth/login', { email, password }, { withCredentials: true })
        const { user, accessToken } = res.data?.data ?? res.data
        set({
          user: { ...user, id: user._id ?? user.id },
          accessToken,
          isAuthenticated: true,
        })
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout', {}, { withCredentials: true })
        } catch {
          // ignore
        } finally {
          set({ user: null, accessToken: null, isAuthenticated: false })
        }
      },

      refreshToken: async () => {
        const res = await apiClient.post('/auth/refresh', {}, { withCredentials: true })
        const { accessToken } = res.data?.data ?? res.data
        set({ accessToken, isAuthenticated: true })
      },

      setUser: (user: User) => set({ user }),

      can: (key: PermissionKey) => {
        const user = get().user
        if (!user) return false
        if (user.role === 'super_admin') return true
        return user.permissions?.[key] === true
      },
    }),
    {
      name: 'altilgraf-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
