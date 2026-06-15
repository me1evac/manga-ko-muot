import { useState, useEffect } from 'react'
import { useStories } from '../hooks/useManga'
import PasswordGate from '../components/Upload/PasswordGate'
import StoryForm from '../components/Upload/StoryForm'
import ChapterForm from '../components/Upload/ChapterForm'
import StoryManager from '../components/Upload/StoryManager'
import Toast from '../components/Common/Toast'
import { GridIcon, PlusDocIcon, StarIcon, GearIcon } from '../components/Icons'

type Tab = 'manage' | 'chapter' | 'story' | 'settings'

interface Stats {
  stories: number
  chapters: number
  pages: number
}

export default function ArchitecturePage() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('arch-auth') === 'true'
  )
  const [tab, setTab] = useState<Tab>('chapter')
  const { stories, refetch } = useStories()
  const [toast, setToast] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (tab !== 'manage') return
    setStatsLoading(true)
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setStats(d as Stats))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [tab])

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  const handleSavePassword = async () => {
    if (newPassword.length < 4) return
    setSavingPassword(true)
    try {
      const res = await fetch('/api/config/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error('failed')
      setToast('Password updated')
      setNewPassword('')
    } catch {
      setToast('Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'manage', label: 'Manage', icon: <GridIcon className="w-5 h-5" /> },
    { key: 'chapter', label: 'Add Chapter', icon: <PlusDocIcon className="w-5 h-5" /> },
    { key: 'story', label: 'New Story', icon: <StarIcon className="w-5 h-5" /> },
    { key: 'settings', label: 'Settings', icon: <GearIcon className="w-5 h-5" /> },
  ]

  return (
    <div className="flex flex-col md:flex-row gap-0 max-w-4xl mx-auto px-4 py-6 min-h-[calc(100vh-6rem)]">
      {toast && (
        <Toast
          message={toast}
          type={toast.includes('updated') || toast.includes('created') || toast.includes('Uploaded') ? 'success' : 'error'}
          onClose={() => setToast(null)}
        />
      )}

      <nav className="flex md:flex-col gap-1 mb-6 md:mb-0 md:w-44 md:shrink-0 md:sticky md:top-6 md:self-start">
        <h1 className="text-lg font-bold md:mb-6 md:px-3 hidden md:block">Architecture</h1>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-purple-600/20 text-purple-300 font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            {t.icon}
            <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 md:pl-8">
        {tab === 'manage' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                  <p className="text-2xl font-bold text-zinc-100">{stats.stories}</p>
                  <p className="text-xs text-zinc-500 mt-1">Stories</p>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                  <p className="text-2xl font-bold text-zinc-100">{stats.chapters}</p>
                  <p className="text-xs text-zinc-500 mt-1">Chapters</p>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                  <p className="text-2xl font-bold text-zinc-100">{stats.pages}</p>
                  <p className="text-xs text-zinc-500 mt-1">Pages</p>
                </div>
              </div>
            )}
            {statsLoading && (
              <div className="text-xs text-zinc-500">Loading stats...</div>
            )}
            <StoryManager onChanged={() => refetch()} />
          </div>
        )}

        {tab === 'story' && (
          <StoryForm onSuccess={() => { refetch(); setToast('Story created') }} />
        )}

        {tab === 'chapter' && (
          <ChapterForm stories={stories} onSuccess={() => refetch()} />
        )}

        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-sm font-medium mb-3">Change Password</h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 4 chars)"
                  className="input-field flex-1"
                />
                <button
                  onClick={handleSavePassword}
                  disabled={newPassword.length < 4 || savingPassword}
                  className="btn-primary shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800">
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
              >
                <span>How it works</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-4 h-4 text-zinc-500 transition-transform ${helpOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {helpOpen && (
                <div className="px-4 pb-4">
                  <ul className="text-xs text-zinc-400 space-y-1.5">
                    <li> Use "New Story" to create a new manga entry with a special ID</li>
                    <li> Use "Add Chapter" to upload pages to an existing story</li>
                    <li> Supported formats: JPG, PNG, WebP (max 70 files per upload)</li>
                    <li> Images are stored via Telegram bot with ~3s stagger delay</li>
                    <li> Stories are sorted by their special ID</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
