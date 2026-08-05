import apiClient from './client'

export interface HomepageSection {
  id: string
  key: string
  label: string
  isVisible: boolean
  order: number
  config?: Record<string, unknown>
}

export interface HomepageSettings {
  sections: { key: string; enabled: boolean }[]
  titles: { featured?: string; latest?: string; mostRead?: string; opinion?: string }
  mostReadEnabled: boolean
  newsletter: { kicker?: string; heading?: string; body?: string }
  categoryRowIds: string[]
  masthead: { enabled: boolean; imageUrl?: string }
}

export const homepageApi = {
  // Layout / text settings
  getSettings: () =>
    apiClient.get('/homepage/settings'),

  saveSettings: (settings: HomepageSettings) =>
    apiClient.put('/homepage/settings', settings),

  // Clears the API's Redis cache and asks the site to drop its ISR copy.
  // Goes through apiClient so it inherits the API base URL and the auth header
  // — a bare fetch() hit the admin's own origin unauthenticated and 404'd.
  invalidate: () =>
    apiClient.post('/homepage/invalidate'),

  getSections: () =>
    apiClient.get('/homepage/sections'),

  updateSection: (id: string, data: Partial<HomepageSection>) =>
    apiClient.put(`/homepage/sections/${id}`, data),

  reorderSections: (orderedIds: string[]) =>
    apiClient.patch('/homepage/sections/reorder', { orderedIds }),

  toggleSection: (id: string) =>
    apiClient.patch(`/homepage/sections/${id}/toggle`),

  getHero: () =>
    apiClient.get('/homepage/hero'),

  setHero: (articleId: string) =>
    apiClient.put('/homepage/hero', { articleId }),

  /** Ordered articles the homepage hero carousel rotates through (max 7) */
  getHeroSlides: () =>
    apiClient.get('/homepage/hero-slides'),

  setHeroSlides: (articleIds: string[]) =>
    apiClient.put('/homepage/hero-slides', { articleIds }),

  getBreaking: () =>
    apiClient.get('/homepage/breaking'),

  setBreaking: (articleId: string) =>
    apiClient.put('/homepage/breaking', { articleId }),

  getFeatured: () =>
    apiClient.get('/homepage/featured'),

  setFeatured: (articleIds: string[]) =>
    apiClient.put('/homepage/featured', { articleIds }),

  searchArticles: (q: string) =>
    apiClient.get('/homepage/search-articles', { params: { q } }),
}
