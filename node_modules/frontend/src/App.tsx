import { Routes, Route } from 'react-router-dom'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import HomePage from './pages/HomePage'
import StoryPage from './pages/StoryPage'
import ReaderPage from './pages/ReaderPage'
import ArchitecturePage from './pages/ArchitecturePage'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/reader/:storyId/:chapterId" element={<ReaderPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
