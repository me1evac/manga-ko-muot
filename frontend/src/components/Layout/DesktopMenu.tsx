import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClockIcon, GearIcon } from '../Icons'

interface Props {
  onClose: () => void
}

export default function DesktopMenu({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const items = [
    { label: 'Read History', icon: ClockIcon, to: '/history' },
    { label: 'Architecture', icon: GearIcon, to: '/architecture' },
  ]

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50 animate-in"
    >
      {items.map((item) => (
        <button
          key={item.to}
          onClick={() => {
            navigate(item.to)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
      <div className="border-t border-zinc-800 mt-1 pt-1 px-4 pb-2">
        <span className="text-xs text-zinc-600">v0.1</span>
      </div>
    </div>
  )
}
