import apiClient from './client'

export interface Comment {
  id: string
  content: string
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  authorName: string
  authorEmail: string
  authorIp?: string
  articleId: string
  articleTitle: string
  parentId?: string
  createdAt: string
}

export const commentsApi = {
  list: (params?: {
    status?: string
    page?: number
    limit?: number
    search?: string
  }) => apiClient.get('/comments', { params }),

  approve: (id: string) =>
    apiClient.patch(`/comments/${id}/approve`),

  reject: (id: string) =>
    apiClient.patch(`/comments/${id}/reject`),

  spam: (id: string) =>
    apiClient.patch(`/comments/${id}/spam`),

  delete: (id: string) =>
    apiClient.delete(`/comments/${id}`),

  bulkApprove: (ids: string[]) =>
    apiClient.patch('/comments/bulk/approve', { ids }),

  bulkReject: (ids: string[]) =>
    apiClient.patch('/comments/bulk/reject', { ids }),

  bulkSpam: (ids: string[]) =>
    apiClient.patch('/comments/bulk/spam', { ids }),

  bulkDelete: (ids: string[]) =>
    apiClient.delete('/comments/bulk', { data: { ids } }),
}
