import { useRef, useCallback, useEffect } from 'react'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'

interface ScrollReaderProps {
  fileIds: string[]
  storyId: string
  chapterId: string
  currentPage: number
  onPageChange: (page: number) => void
}

export default function ScrollReader({ fileIds, storyId, chapterId, currentPage, onPageChange }: ScrollReaderProps) {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const loadedRef = useRef(new Set<string>())
  const [visiblePage, setVisiblePage] = [currentPage, onPageChange]

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = pageRefs.current.findIndex((ref) => ref === entry.target)
            if (idx !== -1) {
              setVisiblePage(idx + 1)
            }
          }
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px 0px 0px' }
    )

    const refs = pageRefs.current.filter(Boolean)
    refs.forEach((ref) => obs.observe(ref!))

    return () => {
      refs.forEach((ref) => obs.unobserve(ref!))
    }
  }, [fileIds, setVisiblePage])

  useEffect(() => {
    const el = pageRefs.current[currentPage - 1]
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, []) // only on mount

  return (
    <div className="max-w-3xl mx-auto">
      {fileIds.map((fileId, i) => (
        <div
          key={fileId}
          ref={(el) => { pageRefs.current[i] = el }}
          className="w-full"
        >
          <LazyImage
            src={api.imageUrl(fileId)}
            alt={`Page ${i + 1}`}
            className="w-full min-h-[50vh]"
            onLoad={() => loadedRef.current.add(fileId)}
          />
          <div className="text-center text-xs text-zinc-600 py-1">
            {i + 1} / {fileIds.length}
          </div>
        </div>
      ))}
    </div>
  )
}
