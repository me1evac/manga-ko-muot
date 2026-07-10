import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story, Chapter, StoryWithChapters } from '../../types'
import { EditIcon, TrashIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '../Icons'

interface StoryManagerProps {
  onChanged: () => void
}

export default function StoryManager({ onChanged }: StoryManagerProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [storyData, setStoryData] = useState<StoryWithChapters | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '' as Story['status'] })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    api.stories.list().then((data) => {
      setStories(data)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
      setToast('Failed to load stories')
    })
  }, [])

  const loadChapters = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setChaptersLoading(true)
    const data = await api.stories.get(id)
    setStoryData(data)
    setChaptersLoading(false)
  }

  const startEdit = (s: Story) => {
    setEditingId(s.id)
    setEditForm({ title: s.title, description: s.description, status: s.status })
  }

  const saveEdit = async (id: string) => {
    try {
      await api.stories.update(id, editForm)
      setEditingId(null)
      setToast('Story updated')
      const data = await api.stories.list()
      setStories(data)
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const deleteStory = async (id: string) => {
    if (!confirm(`Delete story "${id}"? This cannot be undone.`)) return
    try {
      await api.stories.delete(id)
      setToast('Story deleted')
      if (expandedId === id) setExpandedId(null)
      const data = await api.stories.list()
      setStories(data)
      onChanged()
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const deleteChapter = async (storyId: string, chapterId: string) => {
    if (!confirm('Delete this chapter?')) return
    try {
      await api.chapters.delete(storyId, chapterId)
      setToast('Chapter deleted')
      const data = await api.stories.get(storyId)
      setStoryData(data)
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const reorderChapter = async (storyId: string, chapter: Chapter, dir: 'up' | 'down') => {
    if (!storyData) return
    const chapters = storyData.chapters
    const idx = chapters.findIndex((c) => c.id === chapter.id)
    if (idx === -1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= chapters.length) return

    const swap = chapters[swapIdx]
    try {
      await api.chapters.swap(storyId, chapter.id, swap.id)
      setToast(`Chapter moved ${dir}`)
      const data = await api.stories.get(storyId)
      setStoryData(data)
    } catch (e: any) {
      setToast(e.message)
    }
  }

  if (loading) {
    return <div className="text-zinc-400 text-sm py-8 text-center">Loading...</div>
  }

  if (stories.length === 0) {
    return <div className="text-zinc-400 text-sm py-8 text-center">No stories yet</div>
  }

  return (
    <div className="space-y-3">
      {toast && <Toast message={toast} type={toast.includes('updated') || toast.includes('deleted') || toast.includes('moved') ? 'success' : 'error'} onClose={() => setToast(null)} />}

      {stories.map((s) => (
        <div key={s.id} className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Title"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="input-field text-sm resize-none h-16"
                      placeholder="Description"
                    />
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="input-field text-sm"
                    >
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="hiatus">Hiatus</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(s.id)} className="btn-primary text-xs py-1">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost text-xs py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-mono">{s.id}</span>
                      <h3 className="font-medium text-sm truncate">{s.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                        s.status === 'ongoing' ? 'bg-green-900/50 text-green-400' :
                        s.status === 'completed' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{s.description}</p>
                    )}
                  </>
                )}
              </div>

              {editingId !== s.id && (
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button onClick={() => startEdit(s)} className="text-zinc-400 hover:text-white p-1" aria-label="Edit story">
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteStory(s.id)} className="text-red-400 hover:text-red-300 p-1" aria-label="Delete story">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => loadChapters(s.id)} className="text-zinc-400 hover:text-white p-1" aria-label={expandedId === s.id ? 'Collapse chapters' : 'Expand chapters'}>
                    {expandedId === s.id ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {expandedId === s.id && (
            <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Chapters</p>
              {chaptersLoading && !storyData ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-8 bg-zinc-800/50 rounded" />
                  ))}
                </div>
              ) : storyData && storyData.chapters.length === 0 ? (
                <p className="text-xs text-zinc-400">No chapters</p>
              ) : storyData ? (
                storyData.chapters.sort((a, b) => a.number - b.number).map((ch, i) => (
                  <div key={ch.id} className="flex items-center justify-between bg-zinc-800/50 rounded px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => reorderChapter(s.id, ch, 'up')}
                          disabled={i === 0}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                          aria-label="Move chapter up"
                        >
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => reorderChapter(s.id, ch, 'down')}
                          disabled={i === storyData.chapters.length - 1}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                          aria-label="Move chapter down"
                        >
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-zinc-300">{ch.title}</span>
                      <span className="text-[10px] text-zinc-400">Ch.{ch.number} · {ch.pageCount}p</span>
                    </div>
                    <button
                      onClick={() => deleteChapter(s.id, ch.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                      aria-label="Delete chapter"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
