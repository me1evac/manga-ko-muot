import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons'

interface ScrollReaderProps {
  fileIds: string[]
  storyId: string
  chapterId: string
  chapterNumber?: number
  prevChapterId?: string | null
  nextChapterId?: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onToggleMode: () => void
}

export default function ScrollReader({ fileIds, storyId, chapterId, chapterNumber, prevChapterId, nextChapterId, currentPage, totalPages, onPageChange, onToggleMode }: ScrollReaderProps) {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const hasRestored = useRef(false)

  useEffect(() => {
    hasRestored.current = false
  }, [fileIds])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1
        let bestRatio = 0
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const idx = pageRefs.current.findIndex((ref) => ref === entry.target)
            if (idx !== -1) {
              bestIdx = idx
              bestRatio = entry.intersectionRatio
            }
          }
        }
        if (bestIdx !== -1) onPageChange(bestIdx + 1)
      },
      { threshold: 0.3, rootMargin: '-80px 0px 0px 0px' }
    )

    const refs = pageRefs.current.filter(Boolean)
    refs.forEach((ref) => obs.observe(ref!))

    if (!hasRestored.current) {
      const el = pageRefs.current[currentPage - 1]
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' })
        hasRestored.current = true
      }
    }

    return () => refs.forEach((ref) => obs.unobserve(ref!))
  }, [fileIds, onPageChange])

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800 px-4 h-10 flex items-center justify-between">
        <Link to={`/story/${storyId}`} className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </Link>
        <button onClick={onToggleMode} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors text-zinc-300">
          Page Mode
        </button>
      </div>

      <div className="max-w-3xl mx-auto">
        {fileIds.map((fileId, i) => (
          <div key={fileId} ref={(el) => { pageRefs.current[i] = el }} className="w-full">
            <LazyImage
              src={api.imageUrl(fileId)}
              alt={`Page ${i + 1}`}
              className="w-full min-h-[50vh]"
            />
            <div className="text-center text-xs text-zinc-600 py-1">
              {i + 1} / {fileIds.length}
            </div>
          </div>
        ))}
      </div>

      {(prevChapterId || nextChapterId) && (
        <div className="max-w-3xl mx-auto px-4 py-10 flex items-center justify-center gap-6">
          {prevChapterId && (
            <Link
              to={`/reader/${storyId}/${prevChapterId}`}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span>Prev</span>
            </Link>
          )}
          {nextChapterId && (
            <Link
              to={`/reader/${storyId}/${nextChapterId}`}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              <span>Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
