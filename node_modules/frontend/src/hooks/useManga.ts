import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { Story, Chapter, StoryWithChapters } from '../types'

export function useStories() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
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

  return { stories, loading, error, refetch: fetch }
}

export function useStory(id: string | undefined) {
  const [data, setData] = useState<StoryWithChapters | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const d = await api.stories.get(id)
      setData(d)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
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

  return { chapters, loading, error, refetch: fetch }
}
