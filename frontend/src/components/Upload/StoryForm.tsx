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
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setToast('Only JPG, PNG, WebP allowed')
      return
    }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !title.trim()) return

    setUploading(true)
    try {
      let coverFileId = ''
      if (coverFile) {
        const result = await api.upload.cover(coverFile)
        coverFileId = result.fileId
      }

      await api.stories.create({
        id: id.trim(),
        title: title.trim(),
        coverFileId,
        description: description.trim(),
        status,
      })
      setId('')
      setTitle('')
      setDescription('')
      setCoverFile(null)
      setCoverPreview(null)
      setToast('Story created')
      onSuccess()
    } catch (err: any) {
      setToast(err.message)
    } finally {
      setUploading(false)
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
        <label className="block text-sm text-zinc-400 mb-1">Cover Image</label>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <div className="w-24 h-32 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 flex items-center justify-center hover:border-zinc-500 transition-colors">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-zinc-600">+</span>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCover}
              className="hidden"
            />
          </label>
          <div className="text-xs text-zinc-500">
            <p>JPG, PNG, WebP</p>
            <p className="mt-1">Recommended: 3:4 ratio</p>
          </div>
        </div>
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

      <button type="submit" disabled={uploading} className="btn-primary w-full">
        {uploading ? 'Creating...' : 'Create Story'}
      </button>
    </form>
  )
}
