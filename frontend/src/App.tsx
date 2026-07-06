import { Routes, Route, useLocation } from 'react-router-dom'
import { SearchProvider } from './context/SearchContext'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import HomePage from './pages/HomePage'
import StoryPage from './pages/StoryPage'
import ReaderPage from './pages/ReaderPage'
import ArchitecturePage from './pages/ArchitecturePage'
import HistoryPage from './pages/HistoryPage'
import SearchNavigation from './pages/SearchNavigation'
import SearchSheet from './components/Layout/SearchSheet'

export default function App() {
  const loc = useLocation()
  const isReader = loc.pathname.startsWith('/reader/')
  const isSearch = loc.pathname === '/search'

  return (
    <SearchProvider>
      <div className="min-h-screen flex flex-col">
        {!isReader && !isSearch && <Header />}
        <main className="flex-1 pb-16 md:pb-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/story/:id" element={<StoryPage />} />
            <Route path="/reader/:storyId/:chapterId" element={<ReaderPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/search" element={<SearchNavigation />} />
          </Routes>
        </main>
        {!isReader && !isSearch && <BottomNav />}
        <SearchSheet />
      </div>
    </SearchProvider>
  )
}
