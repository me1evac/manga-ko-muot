import { useRef, useCallback } from 'react'
import { api } from '../../services/api'
import LazyImage from '../Common/LazyImage'

interface ScrollReaderProps {
  fileIds: string[]
  storyId: string
  chapterId: string
}

export default function ScrollReader({ fileIds, storyId, chapterId }: ScrollReaderProps) {
  const loadedRef = useRef(new Set<string>())

  const handleLoad = useCallback((fileId: string) => {
    loadedRef.current.add(fileId)
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      {fileIds.map((fileId, i) => (
        <div key={fileId} className="w-full">
          <LazyImage
            src={api.imageUrl(fileId)}
            alt={`Page ${i + 1}`}
            className="w-full min-h-[50vh]"
            onLoad={() => handleLoad(fileId)}
          />
          <div className="text-center text-xs text-zinc-600 py-1">
            {i + 1} / {fileIds.length}
          </div>
        </div>
      ))}
    </div>
  )
}
