import { useState, useCallback } from 'react'
import type { ReadingMode } from '../types'

export function useReader() {
  const [mode, setMode] = useState<ReadingMode>(() => {
    return (localStorage.getItem('readerMode') as ReadingMode) ?? 'scroll'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const changeMode = useCallback((m: ReadingMode) => {
    setMode(m)
    localStorage.setItem('readerMode', m)
  }, [])

  const toggleMode = useCallback(() => {
    changeMode(mode === 'scroll' ? 'left-right' : 'scroll')
  }, [mode, changeMode])

  return {
    mode,
    changeMode,
    toggleMode,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
  }
}
