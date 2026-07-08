import type { Story, Chapter, StoryWithChapters, ChapterIdInfo, PageRecord } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isGet = !init || init.method === undefined || init.method === 'GET'
  const cacheKey = `GET:${path}`

  if (isGet) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T
    }
  }

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
  const data = await res.json()

  if (isGet) {
    cache.set(cacheKey, { data, timestamp: Date.now() })
  }

  return data
}

function clearCache(pattern?: string) {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key)
    }
  } else {
    cache.clear()
  }
}

function notifyMutation() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api:mutation'))
  }
}

export { clearCache, notifyMutation }

export const api = {
  stories: {
    list: () => request<Story[]>('/stories'),
    get: (id: string, params?: { offset?: number; limit?: number }) => {
      let path = `/stories/${id}`
      if (params) {
        const qs = new URLSearchParams()
        if (params.offset !== undefined) qs.set('offset', String(params.offset))
        if (params.limit !== undefined) qs.set('limit', String(params.limit))
        path += '?' + qs.toString()
      }
      return request<StoryWithChapters>(path)
    },
    create: async (data: Partial<Story>) => {
      clearCache('/stories')
      notifyMutation()
      return request<Story>('/stories', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    update: async (id: string, data: Partial<Story>) => {
      clearCache('/stories')
      notifyMutation()
      return request<Story>(`/stories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    },
    delete: async (id: string) => {
      clearCache('/stories')
      notifyMutation()
      return request<{ ok: boolean }>(`/stories/${id}`, { method: 'DELETE' })
    },
    reorder: async (id: string, newOrder: string[]) => {
      clearCache('/stories')
      clearCache('/chapters')
      notifyMutation()
      return request<{ ok: boolean }>(`/stories/${id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order: newOrder }),
      })
    },
  },

  chapters: {
    list: (storyId: string) => request<Chapter[]>(`/chapters/${storyId}`),
    ids: (storyId: string) =>
      request<{ chapters: ChapterIdInfo[] }>(`/chapters/${storyId}/ids`),
    get: (storyId: string, chapterId: string) =>
      request<{ chapter: Chapter; pageCount: number }>(
        `/chapters/${storyId}/${chapterId}`
      ),
    create: async (data: Partial<Chapter>) => {
      clearCache('/stories')
      clearCache('/chapters')
      notifyMutation()
      return request<Chapter>('/chapters', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    reorder: async (storyId: string, chapterId: string, newNumber: number) => {
      clearCache('/chapters')
      clearCache('/stories')
      notifyMutation()
      return request<Chapter>(`/chapters/${storyId}/${chapterId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ newNumber }),
      })
    },
    delete: async (storyId: string, chapterId: string) => {
      clearCache('/chapters')
      clearCache('/stories')
      notifyMutation()
      return request<{ ok: boolean }>(`/chapters/${storyId}/${chapterId}`, {
        method: 'DELETE',
      })
    },
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
      clearCache('/stories')
      notifyMutation()
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
            clearCache('/stories')
            clearCache('/chapters')
            clearCache('/pages')
            notifyMutation()
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
