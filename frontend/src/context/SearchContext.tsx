import { createContext, useContext, useState, type ReactNode } from 'react'

interface SearchContextType {
  query: string
  setQuery: (q: string) => void
  isOpen: boolean
  open: () => void
  close: () => void
}

const SearchContext = createContext<SearchContextType | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const open = () => setIsOpen(true)
  const close = () => {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <SearchContext.Provider value={{ query, setQuery, isOpen, open, close }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}
