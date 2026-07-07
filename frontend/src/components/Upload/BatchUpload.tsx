import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story } from '../../types'
import { loadQueue, saveQueue } from '../../utils/queueStorage'
import type { StoredQueueItem } from '../../utils/queueStorage'

const MAX_FILES = 1
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
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlsRef = useRef<string[]>([])
  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => {
    loadQueue().then((stored: StoredQueueItem[]) => {
      const urls: string[] = []
      const items: QueueItem[] = stored.map(s => {
        const thumbs = s.files.slice(0, 3).map(f => URL.createObjectURL(f))
        urls.push(...thumbs)
        return {
          id: s.id,
          storyId: s.storyId,
          files: s.files,
          chapterNumber: s.chapterNumber,
          title: s.title,
          thumbnails: thumbs,
          status: (s.status === 'pending' ? 'pending' : 'error') as QueueItem['status'],
          error: undefined,
        }
      })
      blobUrlsRef.current.push(...urls)
      if (items.length > 0) {
        nextId = Math.max(...items.map(i => i.id)) + 1
      }
      setQueue(items)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    const items = queueRef.current
      .filter(q => q.status === 'pending' || q.status === 'creating' || q.status === 'uploading' || q.status === 'error')
      .map(q => ({
        id: q.id,
        storyId: q.storyId,
        chapterNumber: q.chapterNumber,
        title: q.title,
        files: q.files,
        status: (q.status === 'creating' || q.status === 'uploading' ? 'error' : q.status) as 'pending' | 'error',
      }))
    saveQueue(items)
  }, [queue, loaded])

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
    const snapshot = queueRef.current
    const pending = snapshot.filter(q => q.status === 'pending')
    if (pending.length === 0) return
    setUploading(true)

    const storyIds = [...new Set(pending.map(q => q.storyId))]

    const existingByStory: Record<string, Set<number>> = {}
    await Promise.all(storyIds.map(async (sid) => {
      try {
        const chapters = await api.chapters.list(sid)
        existingByStory[sid] = new Set(chapters.map(ch => ch.number))
      } catch {
        existingByStory[sid] = new Set()
      }
    }))

    const totalBytes = pending.reduce((sum, q) => sum + q.files.reduce((s, f) => s + f.size, 0), 0)
    let fullyUploadedBytes = 0
    let completed = 0
    let exists = 0

    for (let i = 0; i < snapshot.length; i++) {
      const q = snapshot[i]
      if (q.status !== 'pending') continue

      if (existingByStory[q.storyId]?.has(q.chapterNumber)) {
        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'exists' } : item))
        exists++
        continue
      }

      setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'creating' } : item))

      try {
        const chapter = await api.chapters.create({
          storyId: q.storyId,
          title: q.title,
          number: q.chapterNumber,
        })

        existingByStory[q.storyId].add(q.chapterNumber)

        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))

        for (let c = 0; c < q.files.length; c += MAX_FILES) {
          const chunk = q.files.slice(c, c + MAX_FILES)
          const chunkBytes = chunk.reduce((s, f) => s + f.size, 0)
          await api.upload.pages(q.storyId, chapter.id, chunk, (done) => {
            const pct = Math.min(((fullyUploadedBytes + done) / totalBytes) * 100, 99)
            setProgress(Math.round(pct))
          })
          fullyUploadedBytes += chunkBytes
        }

        setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item))
        completed++
      } catch (err: any) {
        if (/already exists|exists/i.test(err.message ?? '')) {
          setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'exists' } : item))
          exists++
        } else {
          setQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: err.message } : item))
        }
      }
    }

    setUploading(false)
    setProgress(100)
    onSuccess()

    setTimeout(() => {
      setQueue(prev => prev.filter(q => q.status !== 'done' && q.status !== 'exists'))
    }, 2000)

    setToast(`${completed} chapter(s) uploaded, ${exists} skipped (already exist)`)
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
{!uploading && (
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
