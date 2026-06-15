import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story } from '../../types'

const MAX_FILES = 70
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface QueueItem {
  id: number
  storyId: string
  files: File[]
  chapterNumber: number
  title: string
  thumbnails: string[]
  status: 'pending' | 'exists' | 'creating' | 'uploading' | 'done' | 'error'
  error?: string
}

let nextId = 1

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function extractChapterNumber(name: string): number | null {
  const m = name.match(/Chapter\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

function detectFolderName(files: File[]): string | null {
  for (const file of files) {
    const slash = file.webkitRelativePath.indexOf('/')
    if (slash !== -1) return file.webkitRelativePath.slice(0, slash)
  }
  for (const file of files) {
    const p = (file as any).path
    if (typeof p === 'string') {
      const parts = p.replace(/\\/g, '/').split('/')
      if (parts.length >= 2) return parts[parts.length - 2]
    }
  }
  return null
}

interface BatchUploadProps {
  stories: Story[]
  onSuccess: () => void
}

export default function BatchUpload({ stories, onSuccess }: BatchUploadProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  function handlePickFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList).filter(f => ALLOWED_TYPES.has(f.type))
    if (files.length === 0) {
      setToast('No supported images found in the folder')
      return
    }

    files.sort((a, b) => collator.compare(a.name, b.name))

    const folderName = detectFolderName(files)
    const extracted = folderName ? extractChapterNumber(folderName) : null
    const chapterNumber = extracted ??
      (queue.length > 0 ? Math.max(...queue.map(q => q.chapterNumber)) + 1 : 1)

    const thumbUrls = files.slice(0, 3).map(f => URL.createObjectURL(f))
    blobUrlsRef.current.push(...thumbUrls)

    const item: QueueItem = {
      id: nextId++,
      storyId: stories[0]?.id ?? '',
      files,
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      thumbnails: thumbUrls,
      status: 'pending',
    }

    setQueue(prev => [...prev, item])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeItem(id: number) {
    const removed = queue.find(q => q.id === id)
    if (removed) {
      removed.thumbnails.forEach(u => {
        URL.revokeObjectURL(u)
        blobUrlsRef.current = blobUrlsRef.current.filter(b => b !== u)
      })
    }
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  function updateStoryId(id: number, storyId: string) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, storyId } : q))
  }

  async function handleUploadAll() {
    const pending = queue.filter(q => q.status === 'pending')
    if (pending.length === 0) return
    setUploading(true)

    const totalChunks = pending.reduce((sum, q) => sum + Math.ceil(q.files.length / MAX_FILES), 0)
    let chunksDone = 0

    for (let i = 0; i < queue.length; i++) {
      const q = queue[i]
      if (q.status !== 'pending') continue

      setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'creating' } : item))

      try {
        const chapter = await api.chapters.create({
          storyId: q.storyId,
          title: q.title,
          number: q.chapterNumber,
        })

        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))

        for (let c = 0; c < q.files.length; c += MAX_FILES) {
          const chunk = q.files.slice(c, c + MAX_FILES)
          await api.upload.pages(q.storyId, chapter.id, chunk)
          chunksDone++
          setProgress(Math.round((chunksDone / totalChunks) * 100))
        }

        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
      } catch (err: any) {
        if (/already exists|exists/i.test(err.message ?? '')) {
          setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'exists' } : item))
        } else {
          setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: err.message } : item))
        }
      }
    }

    setUploading(false)
    setProgress(100)
    onSuccess()

    const done = queue.filter(q => q.status === 'done').length
    const skipped = queue.filter(q => q.status === 'exists').length
    setToast(`${done} chapter(s) uploaded, ${skipped} skipped (already exist)`)
  }

  const pendingCount = queue.filter(q => q.status === 'pending').length

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={toast.includes('rror') ? 'error' : 'success'} onClose={() => setToast(null)} />}

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-zinc-700 hover:border-zinc-500"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handlePickFolder}
        />
        <p className="text-zinc-400 text-sm">Pick a chapter folder</p>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((q, i) => (
            <div key={q.id} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                  q.status === 'done' ? 'bg-green-500' :
                  q.status === 'exists' ? 'bg-yellow-500' :
                  q.status === 'creating' || q.status === 'uploading' ? 'bg-purple-500 animate-pulse' :
                  q.status === 'error' ? 'bg-red-500' :
                  'bg-zinc-600'
                }`} />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <select
                    value={q.storyId}
                    onChange={e => updateStoryId(q.id, e.target.value)}
                    className="input-field text-xs py-1"
                    disabled={uploading}
                  >
                    {stories.map(s => (
                      <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                    ))}
                  </select>
                  <p className="text-sm font-medium text-zinc-200">{q.title}</p>
                  <p className="text-xs text-zinc-500">{q.files.length} page(s) · {q.status}</p>
                  {q.error && <p className="text-xs text-red-400">{q.error}</p>}
                </div>

                <div className="flex items-start gap-2 shrink-0">
                  {q.thumbnails.length > 0 && (
                    <div className="w-10 h-12 rounded overflow-hidden bg-zinc-800">
                      <img src={q.thumbnails[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!uploading && q.status === 'pending' && (
                    <button
                      onClick={() => removeItem(q.id)}
                      className="text-zinc-600 hover:text-red-400 text-lg leading-none mt-0.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-zinc-500 text-center">Uploading... {progress}%</p>
        </div>
      )}

      {queue.length > 0 && (
        <button
          onClick={handleUploadAll}
          disabled={uploading || pendingCount === 0}
          className="btn-primary w-full"
        >
          {uploading ? 'Uploading...' : `Upload ${pendingCount} chapter(s)`}
        </button>
      )}
    </div>
  )
}
