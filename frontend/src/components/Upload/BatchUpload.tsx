import { useState, useRef, useEffect } from 'react'
import { api } from '../../services/api'
import Toast from '../Common/Toast'
import type { Story, Chapter } from '../../types'

const MAX_FILES = 70
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface ChapterGroup {
  folderName: string
  number: number
  title: string
  files: File[]
  status: 'pending' | 'exists' | 'creating' | 'uploading' | 'done' | 'error'
  error?: string
  thumbnails: string[]
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function extractChapterNumber(name: string): number | null {
  const m = name.match(/Chapter\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

interface BatchUploadProps {
  stories: Story[]
  onSuccess: () => void
}

export default function BatchUpload({ stories, onSuccess }: BatchUploadProps) {
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '')
  const [groups, setGroups] = useState<ChapterGroup[]>([])
  const [uploading, setUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [noSubfolders, setNoSubfolders] = useState(false)
  const existingRef = useRef<Map<number, Chapter>>(new Map())

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    if (!storyId) return
    setGroups([])
    api.chapters.list(storyId).then(chapters => {
      const map = new Map<number, Chapter>()
      chapters.forEach(c => map.set(c.number, c))
      existingRef.current = map
    }).catch(() => {})
  }, [storyId])

  function handleFolderPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const all = Array.from(fileList).filter(f => ALLOWED_TYPES.has(f.type))
    const folderMap = new Map<string, File[]>()

    for (const file of all) {
      const path = file.webkitRelativePath
      const slash = path.indexOf('/')
      const folder = slash === -1 ? '__root__' : path.slice(0, slash)
      if (!folderMap.has(folder)) folderMap.set(folder, [])
      folderMap.get(folder)!.push(file)
    }

    let idx = 0
    const result: ChapterGroup[] = []
    const existing = existingRef.current

    for (const [folder, files] of folderMap) {
      files.sort((a, b) => collator.compare(a.name, b.name))
      const limited = files.slice(0, MAX_FILES)
      const num = folder === '__root__' ? idx + 1 : extractChapterNumber(folder) ?? idx + 1
      const title = `Chapter ${num}`

      result.push({
        folderName: folder,
        number: num,
        title,
        files: limited,
        status: existing.has(num) ? 'exists' : 'pending',
        thumbnails: limited.slice(0, 3).map(f => URL.createObjectURL(f)),
      })

      if (files.length > MAX_FILES && idx === 0) {
        setToast(`Some chapters exceed ${MAX_FILES} files — extra pages truncated`)
      }

      idx++
    }

    const allRoot = result.every(g => g.folderName === '__root__')
    setNoSubfolders(allRoot && result.length === 1 && folderMap.size === 1)

    result.sort((a, b) => a.number - b.number)
    setGroups(result)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUploadAll() {
    if (groups.every(g => g.status !== 'pending')) return
    setUploading(true)

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g.status === 'exists') continue

      setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, status: 'creating' } : grp))

      try {
        const chapter = await api.chapters.create({
          storyId,
          title: g.title,
          number: g.number,
        })

        setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, status: 'uploading' } : grp))

        await api.upload.pages(storyId, chapter.id, g.files)

        setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, status: 'done' } : grp))
      } catch (err: any) {
        if (/already exists|exists/i.test(err.message ?? '')) {
          setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, status: 'exists' } : grp))
        } else {
          setGroups(prev => prev.map((grp, idx) => idx === i ? { ...grp, status: 'error', error: err.message } : grp))
        }
      }

      setOverallProgress(Math.round(((i + 1) / groups.length) * 100))
    }

    setUploading(false)
    setOverallProgress(100)
    onSuccess()

    const done = groups.filter(g => g.status === 'done').length
    const skipped = groups.filter(g => g.status === 'exists').length
    setToast(`${done} chapter(s) uploaded, ${skipped} skipped (already exist)`)
  }

  const pendingCount = groups.filter(g => g.status === 'pending').length

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} type={toast.includes('truncated') || toast.includes('rror') ? 'error' : 'success'} onClose={() => setToast(null)} />}

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Story</label>
        <select value={storyId} onChange={e => setStoryId(e.target.value)} className="input-field">
          {stories.map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
          ))}
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-zinc-700 hover:border-zinc-500"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFolderPick}
        />
        <p className="text-zinc-400 text-sm">Select the <span className="text-purple-400 font-medium">parent folder</span> containing chapter subfolders</p>
        <div className="mt-3 text-left inline-block text-xs text-zinc-600 leading-relaxed">
          <p className="text-zinc-500 mb-1">Expected structure:</p>
          <p className="text-zinc-600">parent-folder/<br/>
          &nbsp;&nbsp;├── Chapter 1/<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── 001.jpg<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── 002.jpg<br/>
          &nbsp;&nbsp;├── Chapter 2/<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── 001.jpg<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── 002.jpg<br/>
          &nbsp;&nbsp;└── ...</p>
        </div>
      </div>

      {noSubfolders && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-300 text-xs">
          No chapter subfolders detected. The selected folder should contain subfolders like "Chapter 1", "Chapter 2", etc. Select the <strong>parent</strong> folder, not a chapter folder.
        </div>
      )}

      {groups.length > 0 && (
        <>
          <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
            <p className="text-sm font-medium text-zinc-300">
              Detected {groups.length} chapter(s)
            </p>
          </div>

          {groups[0].thumbnails.length > 0 && (
            <div className="flex gap-2">
              {groups[0].thumbnails.map((url, i) => (
                <div key={i} className="w-20 h-24 rounded overflow-hidden bg-zinc-800">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {groups.map((g, i) => (
              <div key={i} className="flex items-center justify-between bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    g.status === 'done' ? 'bg-green-500' :
                    g.status === 'exists' ? 'bg-yellow-500' :
                    g.status === 'creating' || g.status === 'uploading' ? 'bg-purple-500 animate-pulse' :
                    g.status === 'error' ? 'bg-red-500' :
                    'bg-zinc-600'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-zinc-500">{g.files.length} page(s)</p>
                    {g.error && <p className="text-xs text-red-400 mt-0.5">{g.error}</p>}
                  </div>
                </div>
                <span className="text-xs text-zinc-500 capitalize">{g.status}</span>
              </div>
            ))}
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${overallProgress}%` }} />
              </div>
              <p className="text-xs text-zinc-500 text-center">Overall: {overallProgress}%</p>
            </div>
          )}

          <button
            onClick={handleUploadAll}
            disabled={uploading || pendingCount === 0}
            className="btn-primary w-full"
          >
            {uploading ? 'Uploading...' : `Upload ${pendingCount} chapter(s)`}
          </button>
        </>
      )}
    </div>
  )
}
