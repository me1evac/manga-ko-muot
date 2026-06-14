import { useState } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'

interface StoryFormProps {
  onSuccess: () => void
}

export default function StoryForm({ onSuccess }: StoryFormProps) {
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'hiatus'>('ongoing')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !title.trim()) return

    setLoading(true)
    try {
      await api.stories.create({
        id: id.trim(),
        title: title.trim(),
        description: description.trim(),
        status,
      })
      setId('')
      setTitle('')
      setDescription('')
      setToast('Story created')
      onSuccess()
    } catch (err: any) {
      setToast(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {toast && <Toast message={toast} type={toast.includes('created') ? 'success' : 'error'} onClose={() => setToast(null)} />}

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Special ID</label>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="input-field"
          placeholder="e.g. S001, OP001"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          placeholder="Story title"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field h-24 resize-none"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="input-field"
        >
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="hiatus">Hiatus</option>
        </select>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creating...' : 'Create Story'}
      </button>
    </form>
  )
}
