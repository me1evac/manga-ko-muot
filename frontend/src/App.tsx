import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import HomePage from './pages/HomePage'
import StoryPage from './pages/StoryPage'
import ReaderPage from './pages/ReaderPage'
import ArchitecturePage from './pages/ArchitecturePage'

export default function App() {
  const loc = useLocation()
  const isReader = loc.pathname.startsWith('/reader/')

  return (
    <div className="min-h-screen flex flex-col">
      {!isReader && <Header />}
      <main className="flex-1 pb-20 md:pb-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/reader/:storyId/:chapterId" element={<ReaderPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
        </Routes>
      </main>
      {!isReader && <BottomNav />}
    </div>
  )
}
