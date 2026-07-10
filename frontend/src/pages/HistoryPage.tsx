import { Link } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/Icons'
import { useStories } from '../hooks/useManga'
import { loadProgress, type ReadProgress } from '../hooks/useReadProgress'
import { StoryCardSkeleton } from '../components/Common/Skeleton'
import { api } from '../services/api'

interface HistoryItem {
  storyId: string
  storyTitle: string
  coverFileId: string
  progress: ReadProgress
}

export default function HistoryPage() {
  const { stories, loading } = useStories()

  const items: HistoryItem[] = []
  for (const story of stories) {
    const progress = loadProgress(story.id)
    if (progress) {
      items.push({
        storyId: story.id,
        storyTitle: story.title,
        coverFileId: story.coverFileId,
        progress,
      })
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Home
      </Link>
      <h1 className="text-xl font-bold mb-6">Read History</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3">
              <StoryCardSkeleton />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl text-zinc-800 mb-4">📖</div>
          <p className="text-zinc-400">Start reading to see your history here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.storyId}
              to={`/story/${item.storyId}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-900 transition-colors border border-zinc-800 hover:border-zinc-700"
            >
              <div className="w-12 h-16 rounded overflow-hidden bg-zinc-800 shrink-0">
                {item.coverFileId ? (
                  <img
                    src={api.imageUrl(item.coverFileId)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                    ◈
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {item.storyTitle}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Chapter {item.progress.chapterNumber} &middot; Page {item.progress.pageNumber}/{item.progress.totalPages}
                </p>
              </div>
              <span className="text-xs text-zinc-400 shrink-0">Continue &rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
