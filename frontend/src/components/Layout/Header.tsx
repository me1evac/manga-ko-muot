import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSearch } from '../../context/SearchContext'
import { SearchIcon, MenuIcon } from '../Icons'
import DesktopMenu from './DesktopMenu'

export default function Header() {
  const { isOpen, open, close } = useSearch()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  function handleSearchClick() {
    setMenuOpen(false)
    if (window.innerWidth < 768) {
      navigate('/search')
      if (isOpen) close()
    } else {
      if (isOpen) { close() } else { open() }
    }
  }

  return (
    <header className="relative sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight text-white">
          Manga Ko Muot
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSearchClick}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            {menuOpen && <DesktopMenu onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
    </header>
  )
}
