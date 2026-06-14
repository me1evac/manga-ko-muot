import ScrollReader from './ScrollReader'
import LeftRightReader from './LeftRightReader'
import type { ReadingMode } from '../../types'

interface ReaderProps {
  mode: ReadingMode
  fileIds: string[]
  storyId: string
  chapterId: string
  currentPage: number
  onPageChange: (page: number) => void
}

export default function Reader({
  mode,
  fileIds,
  storyId,
  chapterId,
  currentPage,
  onPageChange,
}: ReaderProps) {
  if (mode === 'scroll') {
    return (
      <ScrollReader
        fileIds={fileIds}
        storyId={storyId}
        chapterId={chapterId}
      />
    )
  }

  return (
    <LeftRightReader
      fileIds={fileIds}
      currentPage={currentPage}
      onPageChange={onPageChange}
    />
  )
}
