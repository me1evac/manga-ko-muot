import { useCallback, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'

interface LeftRightReaderProps {
  fileIds: string[]
  currentPage: number
  onPageChange: (page: number) => void
}

export default function LeftRightReader({
  fileIds,
  currentPage,
  onPageChange,
}: LeftRightReaderProps) {
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const goNext = useCallback(() => {
    if (currentPage < fileIds.length) {
      onPageChange(currentPage + 1)
    }
  }, [currentPage, fileIds.length, onPageChange])

  const goPrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }, [currentPage, onPageChange])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50
    if (Math.abs(diff) > threshold) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  if (fileIds.length === 0) return null

  const fileId = fileIds[currentPage - 1]

  return (
    <div
      className="fixed inset-0 top-14 bottom-0 z-30 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full flex items-center justify-center">
        <LazyImage
          src={api.imageUrl(fileId)}
          alt={`Page ${currentPage}`}
          className="max-h-full max-w-full"
        />
      </div>

      <div className="absolute inset-0 flex">
        <div
          className="w-1/3 h-full cursor-pointer"
          onClick={goPrev}
        />
        <div className="w-1/3 h-full" />
        <div
          className="w-1/3 h-full cursor-pointer"
          onClick={goNext}
        />
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-full text-sm text-zinc-300">
        {currentPage} / {fileIds.length}
      </div>
    </div>
  )
}
