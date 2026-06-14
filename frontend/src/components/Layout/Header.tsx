import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight text-white">
          Manga Ko Muot
        </Link>
        <span className="text-xs text-zinc-500">v0.1</span>
      </div>
    </header>
  )
}
