import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import BatchUpload from './BatchUpload'
import type { Story, Chapter } from '../../types'

const MAX_FILES = 70
const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

interface ChapterFormProps {
  stories: Story[]
  onSuccess: () => void
}

export default function ChapterForm({ stories, onSuccess }: ChapterFormProps) {
  const [mode, setMode] = useState<'manual' | 'folder'>('manual')
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState('1')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [createdChapter, setCreatedChapter] = useState<Chapter | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const remaining = MAX_FILES - files.length
    const toAdd = accepted.slice(0, remaining)
    setFiles((prev) => [...prev, ...toAdd])
  }, [files.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxFiles: MAX_FILES,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message ?? 'Invalid file'
      setToast(msg)
    },
  })

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleCreateChapter = async () => {
    if (!storyId || !title.trim() || !number) return
    try {
      const ch = await api.chapters.create({
        storyId,
        title: title.trim(),
        number: parseInt(number, 10),
      })
      setCreatedChapter(ch)
      setToast('Chapter created')
    } catch (err: any) {
      setToast(err.message)
    }
  }

  const handleUpload = async () => {
    if (!createdChapter || files.length === 0) return
    setUploading(true)
    try {
      const result = await api.upload.pages(
        storyId,
        createdChapter.id,
        files,
        (loaded, total) => {
          setProgress(Math.round((loaded / total) * 100))
        }
      )
      setToast(`Uploaded ${result.pages.length} pages`)
      setFiles([])
      setCreatedChapter(null)
      setTitle('')
      setNumber('1')
      setProgress(0)
      onSuccess()
    } catch (err: any) {
      setToast(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={toast.includes('rror') ? 'error' : 'success'} onClose={() => setToast(null)} />}

      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${
            mode === 'manual' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode('folder')}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${
            mode === 'folder' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Upload by folder
        </button>
      </div>

      {mode === 'folder' ? (
        <BatchUpload stories={stories} onSuccess={onSuccess} />
      ) : !createdChapter ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Story</label>
            <select
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              className="input-field"
            >
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Chapter Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="e.g. Chapter 1: The Beginning"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Chapter Number</label>
            <input
              type="number"
              min="1"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="input-field"
            />
          </div>

          <button
            onClick={handleCreateChapter}
            disabled={!storyId || !title.trim()}
            className="btn-primary w-full"
          >
            Create Chapter
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
            <p className="text-sm font-medium">{createdChapter.title}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Story: {storyId} · Chapter #{createdChapter.number}
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-zinc-400 text-sm">
              {isDragActive
                ? 'Drop files here'
                : 'Drag & drop images here, or click to select'}
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              JPG, PNG, WebP · Max {MAX_FILES} files
            </p>
          </div>

          {files.length > 0 && (
            <div>
              <p className="text-sm text-zinc-400 mb-2">{files.length} file(s) selected</p>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="relative w-16 h-20 rounded overflow-hidden bg-zinc-800 group"
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-900/80 rounded-full text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Uploading... {progress}%
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="btn-primary w-full"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} page(s)`}
          </button>
        </div>
      )}
    </div>
  )
}
