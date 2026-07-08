import { useState, useEffect, useCallback } from 'react'
import { api, clearCache } from '../services/api'
import type { Story, Chapter, ChapterIdInfo, StoryWithChapters } from '../types'

export function useStories() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (force = false) => {
    try {
      if (force) clearCache('/stories')
      setLoading(true)
      const data = await api.stories.list()
      setStories(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const handler = () => fetch(true)
    window.addEventListener('api:mutation', handler)
    return () => window.removeEventListener('api:mutation', handler)
  }, [fetch])

  return { stories, loading, error, refetch: fetch }
}

export function useStory(id: string | undefined, params?: { offset?: number; limit?: number }) {
  const [data, setData] = useState<StoryWithChapters | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const d = await api.stories.get(id, params)
      setData(d)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id, params?.offset, params?.limit])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const handler = () => { clearCache('/stories'); fetch() }
    window.addEventListener('api:mutation', handler)
    return () => window.removeEventListener('api:mutation', handler)
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function useChapterIds(storyId: string | undefined) {
  const [chapterIds, setChapterIds] = useState<ChapterIdInfo[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!storyId) return
    try {
      setLoading(true)
      const { chapters } = await api.chapters.ids(storyId)
      setChapterIds(chapters)
    } catch {
      setChapterIds([])
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const handler = () => { clearCache('/chapters'); fetch() }
    window.addEventListener('api:mutation', handler)
    return () => window.removeEventListener('api:mutation', handler)
  }, [fetch])

  return { chapterIds, loading, refetch: fetch }
}

export function useChapters(storyId: string | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!storyId) return
    try {
      setLoading(true)
      const data = await api.chapters.list(storyId)
      setChapters(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const handler = () => { clearCache('/chapters'); fetch() }
    window.addEventListener('api:mutation', handler)
    return () => window.removeEventListener('api:mutation', handler)
  }, [fetch])

  return { chapters, loading, error, refetch: fetch }
}
