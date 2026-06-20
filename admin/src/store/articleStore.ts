import { create } from 'zustand'

export interface Article {
  id: string
  title: string
  subtitle?: string
  slug: string
  content: string
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  categoryId: string
  subcategoryId?: string
  authorId: string
  tags: string[]
  featuredImage?: {
    url: string
    alt: string
    caption: string
    publicId: string
  }
  seo: {
    title: string
    description: string
    focusKeyword: string
    canonicalUrl?: string
  }
  publishedAt?: string
  scheduledAt?: string
  expiresAt?: string
  allowComments: boolean
  isBreaking: boolean
  isFeatured: boolean
  isSponsored: boolean
  viewCount: number
  commentCount: number
  createdAt: string
  updatedAt: string
}

export interface ArticleFilters {
  status?: string
  categoryId?: string
  authorId?: string
  search?: string
  page: number
  limit: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface ArticleStore {
  articles: Article[]
  currentArticle: Article | null
  totalCount: number
  isLoading: boolean
  filters: ArticleFilters
  selectedIds: string[]

  setArticles: (articles: Article[], total: number) => void
  setCurrentArticle: (article: Article | null) => void
  setFilters: (filters: Partial<ArticleFilters>) => void
  toggleSelected: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelected: () => void
  setLoading: (loading: boolean) => void
  updateArticleInList: (id: string, updates: Partial<Article>) => void
  removeArticleFromList: (id: string) => void
}

export const useArticleStore = create<ArticleStore>((set) => ({
  articles: [],
  currentArticle: null,
  totalCount: 0,
  isLoading: false,
  filters: {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  selectedIds: [],

  setArticles: (articles, total) => set({ articles, totalCount: total }),
  setCurrentArticle: (article) => set({ currentArticle: article }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((s) => s !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: (ids) => set({ selectedIds: ids }),
  clearSelected: () => set({ selectedIds: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateArticleInList: (id, updates) =>
    set((state) => ({
      articles: state.articles.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  removeArticleFromList: (id) =>
    set((state) => ({
      articles: state.articles.filter((a) => a.id !== id),
      totalCount: state.totalCount - 1,
    })),
}))
