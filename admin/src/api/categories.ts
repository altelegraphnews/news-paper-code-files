import apiClient from './client'

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  imageUrl?: string
  parentId?: string
  order: number
  isActive: boolean
  articleCount?: number
  children?: Category[]
  createdAt: string
}

export const categoriesApi = {
  list: () =>
    apiClient.get('/categories'),

  get: (id: string) =>
    apiClient.get(`/categories/${id}`),

  create: (data: Partial<Category>) =>
    apiClient.post('/categories', data),

  update: (id: string, data: Partial<Category>) =>
    apiClient.put(`/categories/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/categories/${id}`),

  reorder: (orders: { id: string; order: number }[]) =>
    apiClient.post('/categories/reorder', { orders }),
}
