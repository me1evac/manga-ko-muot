import { useNavigate } from 'react-router-dom'
import { useSearch } from '../../context/SearchContext'
import { useStories } from '../../hooks/useManga'
import { SearchIcon, XIcon } from '../Icons'

const RELATED_TAGS = ['Ongoing', 'Completed', 'Hiatus', 'Romance', 'Comedy', 'Fantasy', 'School Life', 'Action']

export default function SearchSheet() {
  const { query, setQuery, isOpen, close } = useSearch()
  const navigate = useNavigate()
  const { stories } = useStories()

  const filtered = query.trim()
    ? stories.filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase().trim())
      )
    : []

  function handleSelect(storyId: string) {
    close()
    navigate(`/story/${storyId}`)
  }

  function handleTagClick(tag: string) {
    setQuery(tag)
  }

  if (!isOpen) return null

  const searchBar = (
    <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-800 bg-zinc-950">
      <SearchIcon className="w-5 h-5 text-zinc-400 shrink-0" />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stories..."
        className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 outline-none text-base"
      />
      <button onClick={close} className="p-1 text-zinc-400 hover:text-white">
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  )

  const relatedSection = !query.trim() && (
    <div className="px-4 py-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Related search</p>
      <div className="flex flex-wrap gap-2">
        {RELATED_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className="px-3 py-1.5 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-full transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )

  const resultsSection = query.trim() && (
    <div className="max-h-80 overflow-y-auto px-4 py-2">
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-center pt-6 pb-4">
          No stories matching "{query}"
        </p>
      ) : (
        filtered.map((story) => (
          <button
            key={story.id}
            onClick={() => handleSelect(story.id)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="flex-1 text-sm text-zinc-200 truncate">
              {story.title}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                story.status === 'ongoing'
                  ? 'bg-green-900/50 text-green-400'
                  : story.status === 'completed'
                    ? 'bg-blue-900/50 text-blue-400'
                    : 'bg-yellow-900/50 text-yellow-400'
              }`}
            >
              {story.status}
            </span>
          </button>
        ))
      )}
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 z-50 bg-zinc-950 md:hidden flex flex-col">
        {searchBar}
        <div className="flex-1 overflow-y-auto">
          {relatedSection}
          {resultsSection}
        </div>
      </div>

      {/* Desktop overlay */}
      <div className="hidden md:block fixed inset-0 z-50 bg-zinc-950 flex flex-col">
        <div className="max-w-5xl mx-auto w-full">
          {searchBar}
          {relatedSection}
          {resultsSection}
        </div>
      </div>
    </>
  )
}
