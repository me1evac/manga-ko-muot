import type { Story, Chapter, StoryWithChapters, PageRecord } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'request failed')
  }
  return res.json()
}

export const api = {
  stories: {
    list: () => request<Story[]>('/stories'),
    get: (id: string) => request<StoryWithChapters>(`/stories/${id}`),
    create: (data: Partial<Story>) =>
      request<Story>('/stories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Story>) =>
      request<Story>(`/stories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/stories/${id}`, { method: 'DELETE' }),
    reorder: (id: string, newOrder: string[]) =>
      request<{ ok: boolean }>(`/stories/${id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order: newOrder }),
      }),
  },

  chapters: {
    list: (storyId: string) => request<Chapter[]>(`/chapters/${storyId}`),
    get: (storyId: string, chapterId: string) =>
      request<{ chapter: Chapter; pageCount: number }>(
        `/chapters/${storyId}/${chapterId}`
      ),
    create: (data: Partial<Chapter>) =>
      request<Chapter>('/chapters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reorder: (storyId: string, chapterId: string, newNumber: number) =>
      request<Chapter>(`/chapters/${storyId}/${chapterId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ newNumber }),
      }),
    delete: (storyId: string, chapterId: string) =>
      request<{ ok: boolean }>(`/chapters/${storyId}/${chapterId}`, {
        method: 'DELETE',
      }),
  },

  upload: {
    cover: async (file: File): Promise<{ fileId: string }> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE}/upload/cover`, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'upload failed' }))
        throw new Error(err.error)
      }
      return res.json()
    },

    pages: async (
      storyId: string,
      chapterId: string,
      files: File[],
      onProgress?: (done: number, total: number) => void
    ): Promise<{ pages: PageRecord[]; totalPages: number }> => {
      const formData = new FormData()
      formData.append('storyId', storyId)
      formData.append('chapterId', chapterId)
      files.forEach((f) => formData.append('files', f))

      const xhr = new XMLHttpRequest()
      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(e.loaded, e.total)
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            try {
              const err = JSON.parse(xhr.responseText)
              reject(new Error(err.error ?? 'upload failed'))
            } catch {
              reject(new Error('upload failed'))
            }
          }
        }
        xhr.onerror = () => reject(new Error('network error'))
        xhr.open('POST', `${BASE}/upload`)
        xhr.send(formData)
      })
    },
  },

  config: {
    getPassword: () =>
      request<{ password: string }>('/config/password'),
    updatePassword: (password: string) =>
      request<{ ok: boolean }>('/config/password', {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
  },

  pages: {
    list: (storyId: string, chapterId: string) =>
      request<{ pages: PageRecord[]; chapterId: string }>(
        `/pages/list/${storyId}/${chapterId}`
      ),
  },

  imageUrl: (fileId: string) => `${BASE}/images/${fileId}`,
}
