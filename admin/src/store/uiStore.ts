import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  sidebarCollapsed: boolean
  darkMode: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleDarkMode: () => void
  setDarkMode: (dark: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      darkMode: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode
          if (next) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          return { darkMode: next }
        }),

      setDarkMode: (dark) => {
        if (dark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        set({ darkMode: dark })
      },
    }),
    {
      name: 'altilgraf-ui',
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) {
          document.documentElement.classList.add('dark')
        }
      },
    }
  )
)
