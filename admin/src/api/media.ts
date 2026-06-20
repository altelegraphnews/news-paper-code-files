import apiClient from './client'

export interface MediaItem {
  id: string
  publicId: string
  url: string
  thumbnailUrl: string
  filename: string
  format: string
  width: number
  height: number
  bytes: number
  folder?: string
  tags?: string[]
  createdAt: string
}

export const mediaApi = {
  list: (params?: { folder?: string; page?: number; limit?: number; search?: string }) =>
    apiClient.get('/media', { params }),

  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    apiClient.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    }),

  delete: (publicId: string) =>
    apiClient.delete(`/media/${encodeURIComponent(publicId)}`),

  bulkDelete: (publicIds: string[]) =>
    apiClient.delete('/media/bulk', { data: { publicIds } }),

  getFolders: () =>
    apiClient.get('/media/folders'),

  createFolder: (name: string) =>
    apiClient.post('/media/folders', { name }),
}
