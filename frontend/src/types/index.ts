export interface Story {
  id: string
  title: string
  coverFileId: string
  description: string
  status: 'ongoing' | 'completed' | 'hiatus'
  createdAt: number
  updatedAt: number
}

export interface Chapter {
  id: string
  storyId: string
  title: string
  number: number
  pageCount: number
  pageFileIds?: string[]
  createdAt: number
}

export interface PageRecord {
  id: string
  chapterId: string
  storyId: string
  fileId: string
  thumbnailId?: string
  pageNumber: number
  format: 'jpg' | 'png' | 'webp' | 'avif'
  fileSize: number
}

export interface StoryWithChapters {
  story: Story
  chapters: Chapter[]
  total: number
  offset: number
}

export interface ChapterIdInfo {
  id: string
  title: string
  number: number
}

export type ReadingMode = 'scroll' | 'left-right'
