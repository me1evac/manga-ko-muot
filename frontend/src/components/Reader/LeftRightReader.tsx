import { useCallback, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'

interface LeftRightReaderProps {
  fileIds: string[]
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function LeftRightReader({
  fileIds,
  currentPage,
  totalPages,
  onPageChange,
}: LeftRightReaderProps) {
  const touchStartX = useRef(0)

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
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  if (fileIds.length === 0) return null

  const fileId = fileIds[currentPage - 1]

  return (
    <div
      className="fixed inset-0 top-24 md:top-10 z-30 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full flex items-center justify-center">
        <LazyImage
          key={currentPage}
          src={api.imageUrl(fileId)}
          alt={`Page ${currentPage}`}
          className="max-h-full max-w-full animate-in"
        />
      </div>

      <div className="absolute inset-0 flex">
        <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
        <div className="w-1/3 h-full" />
        <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
      </div>
    </div>
  )
}
