import apiClient from './client'

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'month' | 'year' | 'all'

export const analyticsApi = {
  // Readership for a preset period or a custom from/to (YYYY-MM-DD, Baghdad days)
  range: (params: { preset?: RangePreset; from?: string; to?: string }) =>
    apiClient.get('/analytics/range', { params }),

  overview: () =>
    apiClient.get('/analytics/overview'),

  views: (period: '7d' | '30d' | '90d') =>
    apiClient.get('/analytics/views', { params: { period } }),

  topArticles: (limit = 10) =>
    apiClient.get('/analytics/top-articles', { params: { limit } }),

  categoryDistribution: () =>
    apiClient.get('/analytics/categories'),

  activeVisitors: () =>
    apiClient.get('/analytics/active-visitors'),

  trending: (limit = 5) =>
    apiClient.get('/analytics/trending', { params: { limit } }),

  dashboard: () =>
    apiClient.get('/analytics/dashboard'),
}
