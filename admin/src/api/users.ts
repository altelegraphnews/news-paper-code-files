import apiClient from './client'
import type { Permissions } from '../store/authStore'

export interface UserRecord {
  id: string
  _id?: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'author' | 'reader' | 'super_admin'
  avatar?: { url?: string } | string
  bio?: string
  jobTitle?: string
  isActive: boolean
  lastLoginAt?: string
  articlesCount?: number
  permissions?: Permissions
  permissionOverrides?: Record<string, boolean>
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: string
  jobTitle?: string
  bio?: string
  permissionOverrides?: Record<string, boolean>
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: string }) =>
    apiClient.get('/users', { params }),

  get: (id: string) =>
    apiClient.get(`/users/${id}`),

  writers: () =>
    apiClient.get('/users/writers'),

  permissionKeys: () =>
    apiClient.get('/users/permission-keys'),

  create: (data: CreateUserPayload) =>
    apiClient.post('/users', data),

  update: (id: string, data: Partial<UserRecord> & { permissionOverrides?: Record<string, boolean> }) =>
    apiClient.put(`/users/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/users/${id}`),

  invite: (email: string, role: string, name: string) =>
    apiClient.post('/users/invite', { email, role, name }),

  resetPassword: (id: string, password?: string) =>
    apiClient.post(`/users/${id}/reset-password`, password ? { password } : {}),

  toggleActive: (id: string) =>
    apiClient.patch(`/users/${id}/toggle-active`),
}
