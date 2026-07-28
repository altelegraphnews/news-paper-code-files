import apiClient from './client'

/** Shape the API actually returns — a populated author OR guest fields. */
export interface Comment {
  _id: string
  id?: string
  content: string
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  author?: { _id?: string; name?: string; avatar?: { url?: string } | string; role?: string } | null
  guestName?: string
  guestEmail?: string
  ipAddress?: string
  article?: { _id?: string; title?: string; slug?: string } | string
  parent?: string | null
  depth?: number
  likes?: number
  createdAt: string
}

export type ModerationStatus = 'approved' | 'rejected' | 'spam'

/**
 * There is exactly one moderation endpoint — PATCH /comments/:id/moderate with
 * the status in the body. The per-action routes this file used to call
 * (/approve, /reject, /spam) never existed, so every moderation click 404'd
 * and the screen could only ever report failure.
 */
const moderate = (id: string, status: ModerationStatus) =>
  apiClient.patch(`/comments/${id}/moderate`, { status })

/**
 * There are no bulk routes either, so bulk actions fan out to single calls.
 * Settled rather than all-or-nothing: a partial failure reports its real count
 * instead of hiding the ones that did go through.
 */
async function fanOut(tasks: Promise<unknown>[]) {
  const results = await Promise.allSettled(tasks)
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) throw new Error(`فشل ${failed} من ${results.length}`)
  return results
}

export const commentsApi = {
  list: (params?: {
    status?: string
    page?: number
    limit?: number
    search?: string
  }) => apiClient.get('/comments', { params }),

  approve: (id: string) => moderate(id, 'approved'),
  reject: (id: string) => moderate(id, 'rejected'),
  spam: (id: string) => moderate(id, 'spam'),

  delete: (id: string) => apiClient.delete(`/comments/${id}`),

  bulkApprove: (ids: string[]) => fanOut(ids.map((id) => moderate(id, 'approved'))),
  bulkReject: (ids: string[]) => fanOut(ids.map((id) => moderate(id, 'rejected'))),
  bulkSpam: (ids: string[]) => fanOut(ids.map((id) => moderate(id, 'spam'))),
  bulkDelete: (ids: string[]) => fanOut(ids.map((id) => apiClient.delete(`/comments/${id}`))),
}
