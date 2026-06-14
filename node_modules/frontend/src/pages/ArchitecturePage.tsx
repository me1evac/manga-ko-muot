import { useState } from 'react'
import { useStories } from '../hooks/useManga'
import PasswordGate from '../components/Upload/PasswordGate'
import StoryForm from '../components/Upload/StoryForm'
import ChapterForm from '../components/Upload/ChapterForm'
import Toast from '../components/Common/Toast'

type Tab = 'story' | 'chapter' | 'settings'

export default function ArchitecturePage() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('arch-auth') === 'true'
  )
  const [tab, setTab] = useState<Tab>('chapter')
  const { stories, refetch } = useStories()
  const [toast, setToast] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chapter', label: 'Add Chapter' },
    { key: 'story', label: 'New Story' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {toast && (
        <Toast
          message={toast}
          type={toast.includes('updated') || toast.includes('created') || toast.includes('Uploaded') ? 'success' : 'error'}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-xl font-bold mb-6">Architecture</h1>

      <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              tab === t.key
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h3 className="text-sm font-medium mb-2">How it works</h3>
            <ul className="text-xs text-zinc-400 space-y-1.5">
              <li>• Use "New Story" to create a new manga entry with a special ID</li>
              <li>• Use "Add Chapter" to upload pages to an existing story</li>
              <li>• Supported formats: JPG, PNG, WebP (max 70 files per upload)</li>
              <li>• Images are stored via Telegram bot with ~3s stagger delay</li>
              <li>• Stories are sorted by their special ID</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
