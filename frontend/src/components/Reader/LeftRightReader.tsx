import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons'

interface LeftRightReaderProps {
  fileIds: string[]
  thumbFileIds: (string | null)[]
  storyId: string
  chapterNumber?: number
  prevChapterId?: string | null
  nextChapterId?: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onToggleMode: () => void
}

export default function LeftRightReader({
  fileIds,
  thumbFileIds,
  storyId,
  chapterNumber,
  prevChapterId,
  nextChapterId,
  currentPage,
  totalPages,
  onPageChange,
  onToggleMode,
}: LeftRightReaderProps) {
  const navigate = useNavigate()
  const touchStartX = useRef(0)
  const [showUI, setShowUI] = useState(true)
  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goNext = useCallback(() => {
    if (currentPage < fileIds.length) {
      onPageChange(currentPage + 1)
    } else if (nextChapterId) {
      navigate(`/reader/${storyId}/${nextChapterId}`)
    }
  }, [currentPage, fileIds.length, onPageChange, nextChapterId, storyId, navigate])

  const goPrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    } else if (prevChapterId) {
      navigate(`/reader/${storyId}/${prevChapterId}`)
    }
  }, [currentPage, onPageChange, prevChapterId, storyId, navigate])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const showTemporarily = () => {
    setShowUI(true)
    clearTimeout(uiTimer.current ?? undefined)
    uiTimer.current = setTimeout(() => setShowUI(false), 2500)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    } else {
      showTemporarily()
    }
  }

  if (fileIds.length === 0) return null

  const fileId = fileIds[currentPage - 1]
  const thumbId = thumbFileIds[currentPage - 1]

  return (
    <div
      className="fixed inset-0 z-30 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={showTemporarily}
    >
      <div
        className={`absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/70 to-transparent px-4 h-14 flex items-center justify-between transition-opacity duration-300 ${
          showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <Link to={`/story/${storyId}`} className="text-sm text-zinc-300 hover:text-white transition-colors">
            ← Back
          </Link>
          {prevChapterId && (
            <Link
              to={`/reader/${storyId}/${prevChapterId}`}
              className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-sm transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span>Prev</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {currentPage}/{totalPages}
          </span>
          <button onClick={onToggleMode} className="text-xs bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1.5 rounded transition-colors text-zinc-300" aria-label="Switch to scroll mode">
            Scroll
          </button>
          {nextChapterId && (
            <Link
              to={`/reader/${storyId}/${nextChapterId}`}
              className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-sm transition-colors"
            >
              <span>Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="h-full flex items-center justify-center">
        <LazyImage
          src={api.imageUrl(fileId)}
          thumbnailSrc={thumbId ? api.imageUrl(thumbId) : null}
          alt={`Page ${currentPage}`}
          className="max-h-full max-w-full animate-in"
        />
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/70 to-transparent px-4 h-10 flex items-center justify-center transition-opacity duration-300 ${
          showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {chapterNumber && <span className="text-xs text-zinc-400">Ch.{chapterNumber}</span>}
      </div>

      <div className="absolute inset-0 flex">
        <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goPrev() }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goPrev() }} aria-label="Previous page" />
        <div className="w-1/3 h-full" />
        <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goNext() }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goNext() }} aria-label="Next page" />
      </div>
    </div>
  )
}
