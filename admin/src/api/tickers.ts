import apiClient from './client'

export interface Ticker {
  id: string
  text: string
  url?: string
  isActive: boolean
  priority: number
  type: 'breaking' | 'normal' | 'update'
  startAt?: string
  endAt?: string
  createdAt: string
}

export const tickersApi = {
  list: () =>
    apiClient.get('/tickers'),

  create: (data: Partial<Ticker>) =>
    apiClient.post('/tickers', data),

  update: (id: string, data: Partial<Ticker>) =>
    apiClient.put(`/tickers/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/tickers/${id}`),

  reorder: (orderedIds: string[]) =>
    apiClient.patch('/tickers/reorder', { orderedIds }),

  toggleActive: (id: string) =>
    apiClient.patch(`/tickers/${id}/toggle-active`),
}
