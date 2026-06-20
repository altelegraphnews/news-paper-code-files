import apiClient from './client'

export const analyticsApi = {
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
