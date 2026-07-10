import { useState } from 'react'

interface PasswordGateProps {
  onUnlock: () => void
}

export default function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)

    try {
      const res = await fetch('/api/config/password')
      const data = await res.json()
      if (password === data.password) {
        sessionStorage.setItem('arch-auth', 'true')
        onUnlock()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20 p-6">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3 text-zinc-400">◇</div>
        <h2 className="text-xl font-semibold">Architecture</h2>
        <p className="text-sm text-zinc-400 mt-1">Enter password to access</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="input-field text-center"
          autoFocus
        />
        {error && (
          <p className="text-red-400 text-sm text-center">Incorrect password</p>
        )}
        <button
          type="submit"
          disabled={!password || loading}
          className="btn-primary w-full"
        >
          {loading ? 'Checking...' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
