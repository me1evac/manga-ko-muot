import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../services/api'
import { useReader } from '../hooks/useReader'
import { usePrefetch } from '../hooks/usePrefetch'
import Reader from '../components/Reader/Reader'
import Skeleton from '../components/Common/Skeleton'

export default function ReaderPage() {
  const { storyId, chapterId } = useParams<{ storyId: string; chapterId: string }>()
  const { mode, toggleMode, currentPage, setCurrentPage, totalPages, setTotalPages } = useReader()
  const [pageFileIds, setPageFileIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId || !chapterId) return
    setLoading(true)
    setError(null)

    api.pages.list(chapterId)
      .then((data) => {
        const sorted = data.pages.sort((a, b) => a.pageNumber - b.pageNumber)
        const ids = sorted.map((p) => p.fileId)
        setPageFileIds(ids)
        setTotalPages(ids.length)
        setCurrentPage(1)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [storyId, chapterId, setCurrentPage, setTotalPages])

  const prefetchUrls = useMemo(() => {
    return pageFileIds.slice(currentPage - 1, currentPage - 1 + (mode === 'scroll' ? 4 : 3))
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

  return (
    <div className={mode === 'left-right' ? '' : 'min-h-screen'}>
      <div className="fixed top-14 left-0 right-0 z-30 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800 px-4 h-10 flex items-center justify-between md:top-0">
        <Link
          to={`/story/${storyId}`}
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Back
        </Link>
        <button
          onClick={toggleMode}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors text-zinc-300"
        >
          {mode === 'scroll' ? 'Page Mode' : 'Scroll Mode'}
        </button>
      </div>

      <div className={mode === 'left-right' ? '' : 'pt-24 md:pt-14'}>
        <Reader
          mode={mode}
          fileIds={pageFileIds}
          storyId={storyId!}
          chapterId={chapterId!}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
