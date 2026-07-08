import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { useReader } from '../hooks/useReader'
import { usePrefetch } from '../hooks/usePrefetch'
import { useChapterIds } from '../hooks/useManga'
import ScrollReader from '../components/Reader/ScrollReader'
import LeftRightReader from '../components/Reader/LeftRightReader'
import Skeleton from '../components/Common/Skeleton'
import { saveProgress } from '../hooks/useReadProgress'

export default function ReaderPage() {
  const { storyId, chapterId } = useParams<{ storyId: string; chapterId: string }>()
  const { mode, toggleMode, currentPage, setCurrentPage, totalPages, setTotalPages } = useReader()
  const [pageFileIds, setPageFileIds] = useState<string[]>([])
  const [thumbFileIds, setThumbFileIds] = useState<(string | null)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { chapterIds } = useChapterIds(storyId)

  const chapterIdx = chapterIds.findIndex(c => c.id === chapterId)
  const prevChapterId = chapterIdx > 0 ? chapterIds[chapterIdx - 1].id : null
  const nextChapterId = chapterIdx < chapterIds.length - 1 ? chapterIds[chapterIdx + 1].id : null
  const chapterNumber = chapterIds[chapterIdx]?.number

  useEffect(() => {
    if (!storyId || !chapterId) return

    setLoading(true)
    setError(null)
    api.pages.list(storyId, chapterId)
      .then((data) => {
        const sorted = data.pages.sort((a, b) => a.pageNumber - b.pageNumber)
        const ids = sorted.map((p) => p.fileId)
        const thumbs = sorted.map((p) => p.thumbnailId ?? null)
        setPageFileIds(ids)
        setThumbFileIds(thumbs)
        setTotalPages(ids.length)
        setCurrentPage(1)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [storyId, chapterId, setCurrentPage, setTotalPages])

  useEffect(() => {
    if (!nextChapterId || !storyId || loading) return
    const timer = setTimeout(() => {
      api.pages.list(storyId, nextChapterId).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [nextChapterId, storyId, loading])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [setCurrentPage])

  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!storyId || !chapterId || !chapterNumber || pageFileIds.length === 0) return
    if (progressTimer.current) clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      saveProgress(storyId, {
        chapterId,
        chapterNumber,
        pageNumber: currentPage,
        totalPages,
      })
    }, 500)
    return () => { if (progressTimer.current) clearTimeout(progressTimer.current) }
  }, [storyId, chapterId, chapterNumber, currentPage, totalPages, pageFileIds.length])

  const prefetchUrls = useMemo(() => {
    return pageFileIds.slice(currentPage, currentPage + (mode === 'scroll' ? 4 : 3))
      .map((id) => api.imageUrl(id))
  }, [pageFileIds, currentPage, mode])

  usePrefetch(prefetchUrls, !loading)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500">{error}</p>
        <Link to={`/story/${storyId}`} className="text-purple-400 text-sm mt-2 inline-block">
          Back to story
        </Link>
      </div>
    )
  }

  if (pageFileIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500">No pages in this chapter</p>
        <Link to={`/story/${storyId}`} className="text-purple-400 text-sm mt-2 inline-block">
          Back to story
        </Link>
      </div>
    )
  }

  if (mode === 'scroll') {
    return (
      <ScrollReader
        fileIds={pageFileIds}
        thumbFileIds={thumbFileIds}
        storyId={storyId!}
        chapterId={chapterId!}
        chapterNumber={chapterNumber}
        prevChapterId={prevChapterId}
        nextChapterId={nextChapterId}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onToggleMode={toggleMode}
      />
    )
  }

  return (
    <LeftRightReader
      fileIds={pageFileIds}
      thumbFileIds={thumbFileIds}
      storyId={storyId!}
      chapterNumber={chapterNumber}
      prevChapterId={prevChapterId}
      nextChapterId={nextChapterId}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      onToggleMode={toggleMode}
    />
  )
}
