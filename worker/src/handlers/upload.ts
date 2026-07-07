import { Hono } from 'hono'
import type { Env, PageRecord, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'
import { compressToWebp } from '../utils/imageCompress'

const MAX_FILES = 100
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EXT_MAP: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function processFile(file: File): Promise<{ buffer: ArrayBuffer; type: string; ext: 'jpg' | 'png' | 'webp' }> {
  const buffer = await file.arrayBuffer()
  const compressed = await compressToWebp(buffer, file.type)
  if (compressed) {
    return { buffer: compressed, type: 'image/webp', ext: 'webp' }
  }
  const ext = EXT_MAP[file.type] ?? 'jpg'
  return { buffer, type: file.type, ext }
}

const app = new Hono<{ Bindings: Env }>()

app.post('/cover', async (c) => {
  const body: any = await c.req.parseBody({ all: true })
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'file required' }, 400)
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: `unsupported format: ${file.type}` }, 400)
  }
  const { buffer, type, ext } = await processFile(file)
  const key = `covers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  await c.env.MANGA_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: type },
  })
  return c.json({ fileId: key }, 201)
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const bucket = c.env.MANGA_BUCKET

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'failed to parse form data' }, 400)
  }

  const storyId = formData.get('storyId') as string | null
  const chapterId = formData.get('chapterId') as string | null
  const files = formData.getAll('files').filter((v): v is File => v instanceof File)

  if (!storyId || !chapterId) {
    return c.json({ error: 'storyId and chapterId required' }, 400)
  }
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)

  if (files.length === 0 || files.length > MAX_FILES) {
    return c.json({ error: `upload between 1 and ${MAX_FILES} files` }, 400)
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: `unsupported format: ${file.type}` }, 400)
    }
  }

  const story = await getJson<any>(kv, KEYS.story(storyId))
  if (!story) return c.json({ error: 'story not found' }, 404)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const chapterIdx = chapters.findIndex(ch => ch.id === chapterId)
  if (chapterIdx === -1) return c.json({ error: 'chapter not found' }, 404)

  const existingPages = (await getJson<PageRecord[]>(kv, KEYS.pages(storyId, chapterId))) ?? []
  let nextPageNum = existingPages.length + 1

  const newPages: PageRecord[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const { buffer, type, ext } = await processFile(file)
    const pageNum = nextPageNum++
    const key = `pages/${storyId}/${chapterId}/${pageNum}.${ext}`

    await bucket.put(key, buffer, {
      httpMetadata: { contentType: type },
    })

    newPages.push({
      id: `p${chapterId}_${pageNum}`,
      chapterId,
      storyId,
      fileId: key,
      pageNumber: pageNum,
      format: ext,
      fileSize: file.size,
    })
  }

  const allPages = [...existingPages, ...newPages]
  await putJson(kv, KEYS.pages(storyId, chapterId), allPages)

  chapters[chapterIdx].pageCount = allPages.length
  await putJson(kv, KEYS.chapters(storyId), chapters)

  return c.json({ pages: newPages, totalPages: chapters[chapterIdx].pageCount }, 201)
})

export default app
