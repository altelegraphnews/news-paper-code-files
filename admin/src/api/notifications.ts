import apiClient from './client'

export interface Notification {
  id: string
  type: 'comment' | 'article' | 'user' | 'system'
  title: string
  message: string
  isRead: boolean
  link?: string
  createdAt: string
}

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    apiClient.get('/notifications', { params }),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),

  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`),

  getUnreadCount: () =>
    apiClient.get('/notifications/unread-count'),
}
