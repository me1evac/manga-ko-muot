import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story } from '../../types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

interface FolderItem {
  id: number
  files: File[]
  chapterNumber: number
  title: string
  thumbnails: string[]
  status: 'pending' | 'exists' | 'creating' | 'uploading' | 'done' | 'error'
  error?: string
}

let nextFolderId = 1

interface UploadSectionProps {
  stories: Story[]
  onSuccess: () => void
}

export default function UploadSection({ stories, onSuccess }: UploadSectionProps) {
  const [mode, setMode] = useState<'manual' | 'folder'>('manual')
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState('1')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [folderItems, setFolderItems] = useState<FolderItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<string[]>([])
  const folderItemsRef = useRef(folderItems)
  folderItemsRef.current = folderItems

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
      previewUrlsRef.current = []
    }
  }, [])

  const removePreview = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function handlePickFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const allFiles = Array.from(fileList).filter(f => ALLOWED_TYPES.includes(f.type))
    if (allFiles.length === 0) {
      setToast('No supported images found')
      return
    }

    allFiles.sort((a, b) => collator.compare(a.name, b.name))

    const folderName = detectFolderName(allFiles)
    const extracted = folderName ? extractChapterNumber(folderName) : null
    const chapterNumber = extracted ??
      (folderItems.length > 0 ? Math.max(...folderItems.map(i => i.chapterNumber)) + 1 : 1)

    const thumbs = allFiles.slice(0, 3).map(f => URL.createObjectURL(f))
    previewUrlsRef.current.push(...thumbs)

    const item: FolderItem = {
      id: nextFolderId++,
      files: allFiles,
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      thumbnails: thumbs,
      status: 'pending',
    }

    setFolderItems(prev => [...prev, item])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFolderItem(id: number) {
    const removed = folderItems.find(i => i.id === id)
    if (removed) {
      removed.thumbnails.forEach(u => {
        URL.revokeObjectURL(u)
        previewUrlsRef.current = previewUrlsRef.current.filter(b => b !== u)
      })
    }
    setFolderItems(prev => prev.filter(i => i.id !== id))
  }

  const handleManualUpload = async () => {
    if (!storyId || !title.trim() || !number || files.length === 0) return

    setUploading(true)
    try {
      const chapter = await api.chapters.create({
        storyId,
        title: title.trim(),
        number: parseInt(number, 10),
      })

      const totalBytes = files.reduce((s, f) => s + f.size, 0)
      let uploadedBytes = 0

      for (let i = 0; i < files.length; i++) {
        const chunk = [files[i]]
        const chunkBytes = files[i].size
        await api.upload.pages(storyId, chapter.id, chunk, (done) => {
          const pct = Math.min(((uploadedBytes + done) / totalBytes) * 100, 99)
          setProgress(Math.round(pct))
        })
        uploadedBytes += chunkBytes
      }

      previews.forEach(u => URL.revokeObjectURL(u))
      setToast(`Uploaded ${files.length} pages`)
      setFiles([])
      setPreviews([])
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

  const handleFolderUpload = async () => {
    const pending = folderItems.filter(i => i.status === 'pending')
    if (pending.length === 0) return

    setUploading(true)

    const storyIds = [...new Set([storyId])]

    const existingByStory: Record<string, Set<number>> = {}
    await Promise.all(storyIds.map(async (sid) => {
      try {
        const chapters = await api.chapters.list(sid)
        existingByStory[sid] = new Set(chapters.map(ch => ch.number))
      } catch {
        existingByStory[sid] = new Set()
      }
    }))

    const totalBytes = pending.reduce((sum, i) => sum + i.files.reduce((s, f) => s + f.size, 0), 0)
    let fullyUploadedBytes = 0
    let completed = 0
    let exists = 0

    for (const item of folderItemsRef.current) {
      if (item.status !== 'pending') continue

      if (existingByStory[storyId]?.has(item.chapterNumber)) {
        setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'exists' as const } : i))
        exists++
        continue
      }

      setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'creating' as const } : i))

      try {
        const chapter = await api.chapters.create({
          storyId,
          title: item.title,
          number: item.chapterNumber,
        })

        existingByStory[storyId].add(item.chapterNumber)

        setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' as const } : i))

        for (let c = 0; c < item.files.length; c++) {
          const file = item.files[c]
          await api.upload.pages(storyId, chapter.id, [file], (done) => {
            const pct = Math.min(((fullyUploadedBytes + done) / totalBytes) * 100, 99)
            setProgress(Math.round(pct))
          })
          fullyUploadedBytes += file.size
        }

        setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' as const } : i))
        completed++
      } catch (err: any) {
        if (/already exists|exists/i.test(err.message ?? '')) {
          setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'exists' as const } : i))
          exists++
        } else {
          setFolderItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' as const, error: err.message } : i))
        }
      }
    }

    setUploading(false)
    setProgress(100)
    onSuccess()

    setTimeout(() => {
      setFolderItems(prev => prev.filter(i => i.status !== 'done' && i.status !== 'exists'))
    }, 2000)

    setToast(`${completed} chapter(s) uploaded, ${exists} skipped (already exist)`)
  }

  const pendingCount = folderItems.filter(i => i.status === 'pending').length

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={toast.includes('rror') || toast.includes('error') ? 'error' : 'success'} onClose={() => setToast(null)} />}

      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === 'manual' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode('folder')}
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === 'folder' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Upload by folder
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Story</label>
          <select value={storyId} onChange={e => setStoryId(e.target.value)} className="input-field" disabled={uploading}>
            {stories.map(s => (
              <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Chapter Number</label>
          <input type="number" min="1" value={number} onChange={e => setNumber(e.target.value)} className="input-field"
            disabled={uploading} />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Chapter Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
            placeholder="e.g. Chapter 1: The Beginning" disabled={uploading} />
        </div>
      </div>

      {mode === 'manual' && (
        <div className="space-y-4">
          <div
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.multiple = true
              input.accept = 'image/jpeg,image/png,image/webp'
              input.onchange = (e: any) => {
                const selected = Array.from(e.target.files as FileList).filter(f => ALLOWED_TYPES.includes(f.type))
                const urls = selected.map(f => URL.createObjectURL(f))
                previewUrlsRef.current.push(...urls)
                setFiles(prev => [...prev, ...selected])
                setPreviews(prev => [...prev, ...urls])
              }
              input.click()
            }}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-zinc-700 hover:border-zinc-500"
          >
            <p className="text-zinc-400 text-sm">Click to select images</p>
            <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP · any number</p>
          </div>

          {files.length > 0 && (
            <div>
              <p className="text-sm text-zinc-400 mb-2">{files.length} file(s) selected</p>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative w-16 h-20 rounded overflow-hidden bg-zinc-800 group">
                    <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                    {!uploading && (
                      <button onClick={() => removePreview(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-900/80 rounded-full text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleManualUpload}
            disabled={uploading || files.length === 0 || !storyId || !title.trim()}
            className="btn-primary w-full"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} page(s)`}
          </button>
        </div>
      )}

      {mode === 'folder' && (
        <div className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-zinc-700 hover:border-zinc-500"
          >
            <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handlePickFolder} />
            <p className="text-zinc-400 text-sm">Pick a chapter folder</p>
          </div>

          {folderItems.length > 0 && (
            <div className="space-y-2">
              {folderItems.map((item, i) => (
                <div key={item.id} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                      item.status === 'done' ? 'bg-green-500' :
                      item.status === 'exists' ? 'bg-yellow-500' :
                      item.status === 'creating' || item.status === 'uploading' ? 'bg-purple-500 animate-pulse' :
                      item.status === 'error' ? 'bg-red-500' :
                      'bg-zinc-600'
                    }`} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.files.length} page(s) · {item.status}</p>
                      {item.error && <p className="text-xs text-red-400">{item.error}</p>}
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      {item.thumbnails.length > 0 && (
                        <div className="w-10 h-12 rounded overflow-hidden bg-zinc-800">
                          <img src={item.thumbnails[0]} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {!uploading && (
                        <button onClick={() => removeFolderItem(item.id)}
                          className="text-zinc-600 hover:text-red-400 text-lg leading-none mt-0.5">×</button>
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

          {folderItems.length > 0 && (
            <button
              onClick={handleFolderUpload}
              disabled={uploading || pendingCount === 0}
              className="btn-primary w-full"
            >
              {uploading ? 'Uploading...' : `Upload ${pendingCount} chapter(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
