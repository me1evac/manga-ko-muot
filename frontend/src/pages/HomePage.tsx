import { useStories } from '../hooks/useManga'
import StoryCard from '../components/Home/StoryCard'
import { StoryCardSkeleton } from '../components/Common/Skeleton'

export default function HomePage() {
  const { stories, loading, error, refetch } = useStories()

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Stories</h1>
        <button
          onClick={() => refetch(true)}
          className="btn-ghost text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <StoryCardSkeleton key={i} />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl text-zinc-800 mb-4">◈</div>
          <p className="text-zinc-500">No stories yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            Go to Architecture tab to add one
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}
