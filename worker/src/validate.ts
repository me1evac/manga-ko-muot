const STORY_ID_RE = /^[A-Z]\w{2,}$/
const CHAPTER_ID_RE = /^ch\d+(_[a-z0-9]+)?$/i

function validateStoryId(id: string): string | null {
  if (!id) return 'storyId is required'
  if (!STORY_ID_RE.test(id)) return 'invalid storyId format (e.g. S001, OP001)'
  return null
}

function validateChapterId(id: string): string | null {
  if (!id) return 'chapterId is required'
  if (!CHAPTER_ID_RE.test(id)) return 'invalid chapterId format (e.g. ch1, ch42)'
  return null
}

export { validateStoryId, validateChapterId }
