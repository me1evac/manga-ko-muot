import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story } from '../../types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES = 35
const MAX_FILE_SIZE = 15 * 1024 * 1024
const MAX_BATCH_BYTES = 1

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface FileEntry {
  file: File
  preview: string
  valid: boolean
  error?: string
}

interface UploadSectionProps {
  stories: Story[]
  onSuccess: () => void
}

export default function UploadSection({ stories, onSuccess }: UploadSectionProps) {
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState('1')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef(0)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    const el = folderInputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    if (!uploading || progress === 0) return
    const id = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed <= 0) return
      const total = (elapsed / progress) * 100
      const remaining = total - elapsed
      if (remaining < 1000) setEta('Almost done')
      else if (remaining < 60000) setEta(`~${Math.ceil(remaining / 1000)}s remaining`)
      else setEta(`~${Math.floor(remaining / 60000)}m ${Math.ceil((remaining % 60000) / 1000)}s remaining`)
    }, 1000)
    return () => clearInterval(id)
  }, [uploading, progress])

  useEffect(() => {
    return () => {
      entriesRef.current.forEach(e => URL.revokeObjectURL(e.preview))
    }
  }, [])

  useEffect(() => {
    if (!uploading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploading])

  function validateFile(file: File): string | undefined {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Unsupported format'
    if (file.size > MAX_FILE_SIZE) return `Exceeds 15MB (${formatSize(file.size)})`
    return undefined
  }

  function addFiles(newFiles: File[], folderName?: string | null) {
    if (entries.length + newFiles.length > MAX_FILES) {
      setToast(`Maximum ${MAX_FILES} files allowed`)
      return
    }

    const detected = folderName ? extractChapterNumber(folderName) : null
    if (detected != null && !title) {
      setNumber(String(detected))
      setTitle(`Chapter ${detected}`)
    }

    const newEntries: FileEntry[] = newFiles.map(file => {
      const err = validateFile(file)
      return { file, preview: URL.createObjectURL(file), valid: !err, error: err }
    })

    setEntries(prev => [...prev, ...newEntries])
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const allFiles = Array.from(fileList).filter(f => ALLOWED_TYPES.includes(f.type))
    if (allFiles.length === 0) { setToast('No supported images found'); return }
    allFiles.sort((a, b) => collator.compare(a.name, b.name))
    addFiles(allFiles)
    e.target.value = ''
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const allFiles = Array.from(fileList).filter(f => ALLOWED_TYPES.includes(f.type))
    if (allFiles.length === 0) { setToast('No supported images found'); return }
    allFiles.sort((a, b) => collator.compare(a.name, b.name))
    const folderName = detectFolderName(allFiles)
    addFiles(allFiles, folderName)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const items = Array.from(e.dataTransfer.items)
    if (items.length === 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => ALLOWED_TYPES.includes(f.type))
      if (files.length > 0) { files.sort((a, b) => collator.compare(a.name, b.name)); addFiles(files) }
      return
    }
    const allFiles: File[] = []
    let folderName: string | null = null
    let pending = 0
    function processEntry(entry: any) {
      if (entry.isDirectory) {
        if (!folderName) folderName = entry.name
        pending++
        const reader = entry.createReader()
        reader.readEntries((entries: any[]) => {
          entries.forEach(e => processEntry(e))
          pending--
          if (pending === 0) finish()
        })
      } else if (entry.isFile) {
        pending++
        entry.file((file: File) => {
          if (ALLOWED_TYPES.includes(file.type)) allFiles.push(file)
          pending--
          if (pending === 0) finish()
        })
      }
    }
    function finish() {
      if (allFiles.length === 0) { setToast('No supported images found'); return }
      allFiles.sort((a, b) => collator.compare(a.name, b.name))
      addFiles(allFiles, folderName)
    }
    items.forEach(item => { const entry = item.webkitGetAsEntry(); if (entry) processEntry(entry) })
    if (pending === 0) finish()
  }

  function removeEntry(idx: number) {
    URL.revokeObjectURL(entries[idx].preview)
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadAll() {
    if (!storyId || !title.trim() || !number) return
    const validEntries = entries.filter(e => e.valid)
    if (validEntries.length === 0) return

    try {
      const existing = await api.chapters.list(storyId)
      if (existing.some(ch => ch.number === parseInt(number, 10))) {
        setToast(`Chapter ${number} already exists`)
        return
      }
    } catch {}

    setUploading(true)
    startTimeRef.current = Date.now()

    try {
      const chapter = await api.chapters.create({
        storyId,
        title: title.trim(),
        number: parseInt(number, 10),
      })

      const files = validEntries.map(e => e.file)
      const totalBytes = files.reduce((s, f) => s + f.size, 0)
      let uploadedBytes = 0

      let batch: File[] = []
      let batchBytes = 0
      for (const file of files) {
        if (batchBytes + file.size > MAX_BATCH_BYTES && batch.length > 0) {
          await uploadBatch(storyId, chapter.id, batch, uploadedBytes, totalBytes)
          uploadedBytes += batch.reduce((s, f) => s + f.size, 0)
          batch = []; batchBytes = 0
        }
        batch.push(file)
        batchBytes += file.size
      }
      if (batch.length > 0) {
        await uploadBatch(storyId, chapter.id, batch, uploadedBytes, totalBytes)
      }

      entries.forEach(e => URL.revokeObjectURL(e.preview))
      setEntries([])
      setTitle(''); setNumber('1')
      setProgress(0); setEta('')
      setToast(`Uploaded ${files.length} pages`)
      onSuccess()
    } catch (err: any) {
      setToast(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function uploadBatch(storyId: string, chapterId: string, files: File[], uploadedBytes: number, totalBytes: number) {
    await api.upload.pages(storyId, chapterId, files, (done) => {
      const pct = Math.min(((uploadedBytes + done) / totalBytes) * 100, 99)
      setProgress(Math.round(pct))
    })
  }

  const invalidFiles = entries.filter(e => !e.valid)
  const validCount = entries.filter(e => e.valid).length
  const totalSize = entries.reduce((s, e) => s + e.file.size, 0)

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={toast.includes('rror') || toast.includes('error') || toast.includes('already') ? 'error' : 'success'} onClose={() => setToast(null)} />}

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Story</label>
        <select value={storyId} onChange={e => setStoryId(e.target.value)} className="input-field" disabled={uploading}>
          {stories.map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Chapter #</label>
          <input type="number" min="1" value={number} onChange={e => setNumber(e.target.value)}
            className="input-field" disabled={uploading} />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
            placeholder="e.g. Chapter 1: The Beginning" disabled={uploading} />
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-purple-500 bg-purple-900/20' : 'border-zinc-700 hover:border-zinc-500'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }} onChange={handleFileSelect} />
        <input ref={folderInputRef} type="file" multiple style={{ display: 'none' }}
          onChange={handleFolderSelect} />

        <div className="text-zinc-400 text-sm mb-2">
          Drop images or click to select
        </div>
        <p className="text-zinc-600 text-xs">
          JPG, PNG, WebP · max {MAX_FILES} files · 15MB each
        </p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors text-zinc-300">
            Select files
          </button>
          <span className="text-zinc-700 text-xs">or</span>
          <button onClick={e => { e.stopPropagation(); folderInputRef.current?.click() }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors text-zinc-300">
            Select folder
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            {entries.length} file(s) · {formatSize(totalSize)}
            {invalidFiles.length > 0 && (
              <span className="text-red-400 ml-2">({invalidFiles.length} invalid)</span>
            )}
          </p>

          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
            {entries.map((entry, i) => (
              <div key={i} className={`flex items-center gap-3 bg-zinc-900/50 rounded-lg px-3 py-2 border ${
                entry.valid ? 'border-zinc-800' : 'border-red-900/50'
              }`}>
                <div className="w-10 h-12 rounded overflow-hidden bg-zinc-800 shrink-0">
                  <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate">{entry.file.name}</p>
                  <p className={`text-[10px] ${entry.valid ? 'text-zinc-500' : 'text-red-400'}`}>
                    {formatSize(entry.file.size)}
                    {entry.error && ` · ${entry.error}`}
                  </p>
                </div>
                {!uploading && (
                  <button onClick={() => removeEntry(i)}
                    className="text-zinc-600 hover:text-red-400 text-lg leading-none shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <button onClick={uploadAll} disabled={uploading || validCount === 0 || !storyId || !title.trim() || !number}
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          {uploading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {uploading ? 'Uploading...' : `Upload ${validCount} page(s)`}
        </button>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/30 border border-amber-800/50 rounded-lg px-3 py-2">
            <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Upload in progress — don't switch tabs or navigate away</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Uploading... {progress}%</span>
            {eta && <span>{eta}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
