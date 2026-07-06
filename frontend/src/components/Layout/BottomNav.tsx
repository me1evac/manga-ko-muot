import { NavLink } from 'react-router-dom'
import { HomeIcon } from '../Icons'

const links = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/architecture', label: 'Architecture', icon: null, unicode: '◇' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800 md:hidden">
      <div className="flex items-center justify-around h-16">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-6 py-2 text-xs transition-colors ${
                isActive ? 'text-purple-400' : 'text-zinc-500'
              }`
            }
          >
            {link.icon ? (
              <link.icon className="w-5 h-5" />
            ) : (
              <span className="text-lg">{link.unicode}</span>
            )}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
