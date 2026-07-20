import apiClient from './client'

export interface HomepageSection {
  id: string
  key: string
  label: string
  isVisible: boolean
  order: number
  config?: Record<string, unknown>
}

export const homepageApi = {
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
