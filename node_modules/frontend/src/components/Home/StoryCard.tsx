import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { formatDate } from '../../utils/image'
import type { Story } from '../../types'

export default function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      to={`/story/${story.id}`}
      className="group block bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all hover:bg-zinc-900"
    >
      <div className="aspect-[3/4] bg-zinc-800 overflow-hidden">
        {story.coverFileId ? (
          <img
            src={api.imageUrl(story.coverFileId)}
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-4xl">
            ◈
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm text-zinc-100 truncate">
          {story.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            story.status === 'ongoing' ? 'bg-green-900/50 text-green-400' :
            story.status === 'completed' ? 'bg-blue-900/50 text-blue-400' :
            'bg-yellow-900/50 text-yellow-400'
          }`}>
            {story.status}
          </span>
          <span className="text-xs text-zinc-500">{formatDate(story.updatedAt)}</span>
        </div>
      </div>
    </Link>
  )
}
