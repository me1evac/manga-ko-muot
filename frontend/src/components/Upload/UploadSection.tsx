import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story } from '../../types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PER_CHAPTER_MAX_FILES = 35
const MAX_FILE_SIZE = 15 * 1024 * 1024

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function extractChapterNumber(name: string): number | null {
  let m = name.match(/(?:Chapter|Ch\.?)\s*(\d+)/i)
  if (m) return parseInt(m[1], 10)
  m = name.match(/(?:Vol|Volume)\.?\s*\d+\s*(?:Ch|Chapter)\.?\s*(\d+)/i)
  if (m) return parseInt(m[1], 10)
  m = name.match(/^(\d+)$/)
  if (m) return parseInt(m[1], 10)
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

interface ChapterGroup {
  folderName: string
  chapterNumber: number
  title: string
  entries: FileEntry[]
}

interface UploadSectionProps {
  stories: Story[]
  onSuccess: () => void
}

export default function UploadSection({ stories, onSuccess }: UploadSectionProps) {
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '')
  const [chapters, setChapters] = useState<ChapterGroup[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentChapterLabel, setCurrentChapterLabel] = useState('')
  const [eta, setEta] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const folderInputRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef(0)
  const chaptersRef = useRef(chapters)
  chaptersRef.current = chapters

  useEffect(() => {
    const el = folderInputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    return () => {
      chaptersRef.current.forEach(ch =>
        ch.entries.forEach(e => URL.revokeObjectURL(e.preview))
      )
    }
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

  function groupFilesByFolder(files: File[]): Map<string, File[]> {
    const groups = new Map<string, File[]>()
    for (const file of files) {
      let key: string | null = null
      const slash = file.webkitRelativePath.indexOf('/')
      if (slash !== -1) {
        key = file.webkitRelativePath.slice(0, slash)
      } else {
        const p = (file as any).path || file.name
        if (typeof p === 'string') {
          const parts = p.replace(/\\/g, '/').split('/')
          if (parts.length >= 2) key = parts[parts.length - 2]
        }
      }
      if (!key) key = '_root'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(file)
    }
    return groups
  }

  function createEntries(files: File[]): FileEntry[] {
    return files.map(file => {
      const err = validateFile(file)
      return { file, preview: URL.createObjectURL(file), valid: !err, error: err }
    })
  }

  function addChapterGroup(files: File[], folderName: string | null) {
    const name = folderName ?? `Group ${Date.now()}`
    const existing = chapters.findIndex(ch => ch.folderName === name)
    const newEntries = createEntries(files)

    if (existing >= 0) {
      const combined = [...chapters[existing].entries, ...newEntries]
      if (combined.length > PER_CHAPTER_MAX_FILES) {
        setToast(`Maximum ${PER_CHAPTER_MAX_FILES} files per chapter`)
        newEntries.forEach(e => URL.revokeObjectURL(e.preview))
        return
      }
      const updated = [...chapters]
      updated[existing] = { ...updated[existing], entries: combined }
      setChapters(updated)
    } else {
      const chNum = extractChapterNumber(name) ?? chapters.length + 1
      setChapters(prev => [...prev, {
        folderName: name,
        chapterNumber: chNum,
        title: name.replace(/[_-]/g, ' '),
        entries: newEntries,
      }])
    }
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const allFiles = Array.from(fileList).filter(f => ALLOWED_TYPES.includes(f.type))
    if (allFiles.length === 0) { setToast('No supported images found'); return }
    allFiles.sort((a, b) => collator.compare(a.name, b.name))
    const groups = groupFilesByFolder(allFiles)
    for (const [folder, files] of groups) {
      addChapterGroup(files, folder === '_root' ? null : folder)
    }
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const items = Array.from(e.dataTransfer.items)
    if (items.length === 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => ALLOWED_TYPES.includes(f.type))
      if (files.length > 0) { files.sort((a, b) => collator.compare(a.name, b.name)); addChapterGroup(files, null) }
      return
    }
    const groups = new Map<string, File[]>()
    let pending = 0
    let finished = false
    function processEntry(entry: any, currentFolder?: string) {
      if (entry.isDirectory) {
        pending++
        const folder = currentFolder ?? entry.name
        const reader = entry.createReader()
        reader.readEntries((entries: any[]) => {
          entries.forEach(e => processEntry(e, folder))
          pending--
          if (finished && pending === 0) done()
        })
      } else if (entry.isFile) {
        pending++
        entry.file((file: File) => {
          if (ALLOWED_TYPES.includes(file.type)) {
            const folder = currentFolder ?? '_root'
            if (!groups.has(folder)) groups.set(folder, [])
            groups.get(folder)!.push(file)
          }
          pending--
          if (finished && pending === 0) done()
        })
      }
    }
    function done() {
      if (groups.size === 0) { setToast('No supported images found'); return }
      for (const [folder, files] of groups) {
        if (files.length === 0) continue
        files.sort((a, b) => collator.compare(a.name, b.name))
        addChapterGroup(files, folder === '_root' ? null : folder)
      }
    }
    items.forEach(item => { const entry = item.webkitGetAsEntry(); if (entry) processEntry(entry) })
    finished = true
    if (pending === 0) done()
  }

  function updateChapter(index: number, updates: Partial<ChapterGroup>) {
    setChapters(prev => prev.map((ch, i) => i === index ? { ...ch, ...updates } : ch))
  }

  function removeChapter(index: number) {
    const ch = chapters[index]
    ch.entries.forEach(e => URL.revokeObjectURL(e.preview))
    setChapters(prev => prev.filter((_, i) => i !== index))
  }

  async function uploadAll() {
    const validGroups = chapters.map((ch, ci) => ({
      chapterIndex: ci,
      chapter: ch,
      validEntries: ch.entries.filter(e => e.valid),
    })).filter(x => x.validEntries.length > 0)

    if (validGroups.length === 0) return

    let totalBytes = 0
    let totalFiles = 0
    for (const { validEntries } of validGroups) {
      totalFiles += validEntries.length
      totalBytes += validEntries.reduce((s, e) => s + e.file.size, 0)
    }

    let existingNumbers: Set<number>
    try {
      const existing = await api.chapters.list(storyId)
      existingNumbers = new Set(existing.map(ch => ch.number))
    } catch { existingNumbers = new Set() }

    const toUpload = validGroups.filter(({ chapter }) => {
      if (existingNumbers.has(chapter.chapterNumber)) {
        setToast(`Chapter ${chapter.chapterNumber} already exists, skipping`)
        return false
      }
      return true
    })

    if (toUpload.length === 0) { setToast('All chapters already exist'); return }

    setUploading(true)
    startTimeRef.current = Date.now()
    setCurrentChapterLabel('Preparing...')

    let uploadedBytes = 0

    try {
      for (const { chapter, validEntries } of toUpload) {
        setCurrentChapterLabel(`Chapter ${chapter.chapterNumber}: ${chapter.title}`)

        const apiChapter = await api.chapters.create({
          storyId,
          title: chapter.title,
          number: chapter.chapterNumber,
        })

        for (const entry of validEntries) {
          await api.upload.pages(storyId, apiChapter.id, [entry.file], (done) => {
            const pct = Math.min(((uploadedBytes + done) / totalBytes) * 100, 99)
            setProgress(Math.round(pct))
          })
          uploadedBytes += entry.file.size
        }
      }

      for (const ch of chapters) {
        ch.entries.forEach(e => URL.revokeObjectURL(e.preview))
      }
      setChapters([])
      setProgress(0); setEta(''); setCurrentChapterLabel('')
      setToast(`Uploaded ${totalFiles} pages across ${toUpload.length} chapter(s)`)
      onSuccess()
    } catch (err: any) {
      setToast(err.message)
    } finally {
      setUploading(false)
    }
  }

  const totalFiles = chapters.reduce((s, ch) => s + ch.entries.filter(e => e.valid).length, 0)
  const totalChapters = chapters.length

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={
        toast.includes('rror') || toast.includes('error') || toast.includes('already')
          ? 'error' : 'success'
      } onClose={() => setToast(null)} />}

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Story</label>
        <select value={storyId} onChange={e => setStoryId(e.target.value)} className="input-field" disabled={uploading}>
          {stories.map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
          ))}
        </select>
      </div>

      {chapters.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">
            {totalChapters} chapter(s) · {totalFiles} file(s)
          </h3>
          {chapters.map((ch, i) => {
            const chSize = ch.entries.reduce((s, e) => s + e.file.size, 0)
            return (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-20 truncate shrink-0" title={ch.folderName}>{ch.folderName}</span>
                  <input type="number" min="1" value={ch.chapterNumber}
                    onChange={e => updateChapter(i, { chapterNumber: parseInt(e.target.value) || 1 })}
                    className="input-field w-16 text-sm" disabled={uploading} />
                  <input value={ch.title}
                    onChange={e => updateChapter(i, { title: e.target.value })}
                    className="input-field flex-1 text-sm min-w-0" disabled={uploading}
                    placeholder="Chapter title" />
                  <span className="text-xs text-zinc-400 whitespace-nowrap shrink-0">
                    {ch.entries.length} · {formatSize(chSize)}
                  </span>
                  {!uploading && (
                    <button onClick={() => removeChapter(i)}
                      className="text-zinc-400 hover:text-red-400 text-lg leading-none shrink-0" aria-label={`Remove ${ch.folderName}`}>×</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ch.entries.map((entry, j) => (
                    <div key={j} className={`relative w-9 h-11 rounded overflow-hidden shrink-0 border ${
                      entry.valid ? 'border-zinc-800' : 'border-red-900/50'
                    }`} title={`${entry.file.name}${entry.error ? `  · ${entry.error}` : ''}`}>
                      <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                      {!entry.valid && (
                        <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                          <span className="text-[8px] text-red-300 font-bold">!</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => folderInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-purple-500 bg-purple-900/20' : 'border-zinc-700 hover:border-zinc-500'
        }`}
      >
        <input ref={folderInputRef} type="file" multiple style={{ display: 'none' }}
          onChange={handleFolderSelect} aria-label="Select folder" />

        <div className="text-zinc-400 text-sm mb-2">
          Drop folders here or click to select
        </div>
        <p className="text-zinc-400 text-xs">
          Each subfolder becomes a chapter · JPG, PNG, WebP · {PER_CHAPTER_MAX_FILES} files max per chapter · 15MB each
        </p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={e => { e.stopPropagation(); folderInputRef.current?.click() }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors text-zinc-300">
            Select folder
          </button>
        </div>
      </div>

      {totalChapters > 0 && (
        <button onClick={uploadAll} disabled={uploading || !storyId}
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          {uploading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {uploading
            ? `Uploading...${currentChapterLabel ? ` (${currentChapterLabel})` : ''}`
            : `Upload ${totalChapters} chapter(s) (${totalFiles} page(s))`}
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
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{currentChapterLabel || 'Uploading...'} {progress}%</span>
            {eta && <span>{eta}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
