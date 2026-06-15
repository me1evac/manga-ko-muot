import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStory } from '../hooks/useManga'
import { api } from '../services/api'
import { formatDate } from '../utils/image'
import { loadProgress } from '../hooks/useReadProgress'
import Skeleton from '../components/Common/Skeleton'

const LIMIT = 20

export default function StoryPage() {
  const { id } = useParams<{ id: string }>()
  const [offset, setOffset] = useState(0)
  const { data, loading, error } = useStory(id, { offset, limit: LIMIT })

  if (loading && !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500">{error ?? 'Story not found'}</p>
        <Link to="/" className="text-purple-400 text-sm mt-2 inline-block">
          Back to home
        </Link>
      </div>
    )
  }

  const { story, chapters, total } = data
  const progress = loadProgress(story.id)
  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors inline-block mb-4">
        ← Back to home
      </Link>

      <div className="flex gap-6 mb-8">
        <div className="w-32 h-44 shrink-0 rounded-xl overflow-hidden bg-zinc-800">
          {story.coverFileId ? (
            <img
              src={api.imageUrl(story.coverFileId)}
              alt={story.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl">
              ◈
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">{story.title}</h1>
          <p className="text-sm text-zinc-400 mt-1">ID: {story.id}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded mt-2 ${
            story.status === 'ongoing' ? 'bg-green-900/50 text-green-400' :
            story.status === 'completed' ? 'bg-blue-900/50 text-blue-400' :
            'bg-yellow-900/50 text-yellow-400'
          }`}>
            {story.status}
          </span>
          {story.description && (
            <p className="text-sm text-zinc-400 mt-3 line-clamp-3">
              {story.description}
            </p>
          )}
          <p className="text-xs text-zinc-600 mt-2">
            Updated {formatDate(story.updatedAt)}
          </p>
          {progress && (
            <Link
              to={`/reader/${story.id}/${progress.chapterId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Continue to read at Chapter {progress.chapterNumber}
              <span className="text-xs text-zinc-500">
                (page {progress.pageNumber}/{progress.totalPages})
              </span>
            </Link>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">
        Chapters ({total})
      </h2>

      {total === 0 ? (
        <p className="text-zinc-600 text-sm">No chapters yet</p>
      ) : (
        <div className="space-y-2">
          {chapters.map((ch) => (
            <Link
              key={ch.id}
              to={`/reader/${story.id}/${ch.id}`}
              className="block bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-900 hover:border-zinc-600 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{ch.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {ch.pageCount} pages · Ch. {ch.number}
                  </p>
                </div>
                <span className="text-zinc-600 text-lg">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 pb-8">
          <button
            onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(o => o + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="px-4 py-2 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
