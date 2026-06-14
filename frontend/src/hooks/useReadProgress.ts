export interface ReadProgress {
  chapterId: string
  chapterNumber: number
  pageNumber: number
  totalPages: number
}

function key(storyId: string) {
  return `read-progress-${storyId}`
}

export function saveProgress(
  storyId: string,
  data: ReadProgress
) {
  try {
    localStorage.setItem(key(storyId), JSON.stringify(data))
  } catch {
    // storage full or unavailable
  }
}

export function loadProgress(storyId: string): ReadProgress | null {
  try {
    const raw = localStorage.getItem(key(storyId))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearProgress(storyId: string) {
  try {
    localStorage.removeItem(key(storyId))
  } catch {
    // ignore
  }
}
