import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SearchProvider } from './context/SearchContext'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import SearchSheet from './components/Layout/SearchSheet'

const HomePage = lazy(() => import('./pages/HomePage'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SearchNavigation = lazy(() => import('./pages/SearchNavigation'))

export default function App() {
  const loc = useLocation()
  const isReader = loc.pathname.startsWith('/reader/')
  const isSearch = loc.pathname === '/search'

  return (
    <SearchProvider>
      <div className="min-h-screen flex flex-col">
        {!isReader && !isSearch && <Header />}
        <main className="flex-1 pb-16 md:pb-6">
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-400 text-sm">Loading...</div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/story/:id" element={<StoryPage />} />
              <Route path="/reader/:storyId/:chapterId" element={<ReaderPage />} />
              <Route path="/architecture" element={<ArchitecturePage />} />
              <Route path="/history" element={<HistoryPage />} />
            <Route path="/search" element={<SearchNavigation />} />
            <Route path="*" element={<div className="text-center py-20 text-zinc-400 text-sm">Page not found</div>} />
          </Routes>
          </Suspense>
        </main>
        {!isReader && !isSearch && <BottomNav />}
        <SearchSheet />
      </div>
    </SearchProvider>
  )
}
