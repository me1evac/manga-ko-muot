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
  createdAt: number
}

export interface PageRecord {
  id: string
  chapterId: string
  storyId: string
  fileId: string
  pageNumber: number
  format: 'jpg' | 'png' | 'webp'
  fileSize: number
}

export interface Env {
  MANGA_KV: KVNamespace
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHAT_ID: string
  ADMIN_PASSWORD: string
}
