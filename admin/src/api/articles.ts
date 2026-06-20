import apiClient from './client'

export const articlesApi = {
  list: (params: Record<string, any>) =>
    apiClient.get('/articles', { params }),

  get: (id: string) =>
    apiClient.get(`/articles/${id}`),

  create: (data: Record<string, any>) =>
    apiClient.post('/articles', data),

  update: (id: string, data: Record<string, any>) =>
    apiClient.put(`/articles/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/articles/${id}`),

  bulkDelete: (ids: string[]) =>
    apiClient.delete('/articles/bulk', { data: { ids } }),

  bulkStatus: (ids: string[], status: string) =>
    apiClient.patch('/articles/bulk/status', { ids, status }),

  publish: (id: string) =>
    apiClient.post(`/articles/${id}/publish`),

  unpublish: (id: string) =>
    apiClient.post(`/articles/${id}/unpublish`),

  submit: (id: string) =>
    apiClient.post(`/articles/${id}/submit`),

  approve: (id: string, note?: string) =>
    apiClient.post(`/articles/${id}/approve`, { note }),

  reject: (id: string, note: string) =>
    apiClient.post(`/articles/${id}/reject`, { note }),

  pendingCount: () =>
    apiClient.get('/articles/pending-count'),

  schedule: (id: string, scheduledAt: string) =>
    apiClient.put(`/articles/${id}`, { status: 'scheduled', publishAt: scheduledAt }),

  getRevisions: (id: string) =>
    apiClient.get(`/articles/${id}/revisions`),

  restoreRevision: (id: string, revisionId: string) =>
    apiClient.post(`/articles/${id}/revisions/${revisionId}/restore`),

  getTags: (query?: string) =>
    apiClient.get('/tags', { params: { q: query } }),

  checkSlug: (slug: string, excludeId?: string) =>
    apiClient.get('/articles/check-slug', { params: { slug, excludeId } }),
}
