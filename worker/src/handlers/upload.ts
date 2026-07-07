import { Hono } from 'hono'
import type { Env, PageRecord, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'

const STAGGER_MS = 3000
const MAX_FILES = 70
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EXT_MAP: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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

  const ext = EXT_MAP[file.type] ?? 'jpg'
  const key = `covers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  await c.env.MANGA_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  return c.json({ fileId: key }, 201)
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const bucket = c.env.MANGA_BUCKET

  const body: any = await c.req.parseBody({ all: true })
  const storyId = body.storyId as string
  const chapterId = body.chapterId as string
  const raw = body['files']
  const files = Array.isArray(raw) ? raw : raw ? [raw] : []

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

  const pagePrefix = `page:${storyId}:${chapterId}:`
  const existingPageKeys = await kv.list({ prefix: pagePrefix })
  let pageNum = 1
  if (existingPageKeys.keys.length > 0) {
    const nums = existingPageKeys.keys
      .map(k => parseInt(k.name.split(':').pop()!, 10))
      .filter(n => !isNaN(n))
    if (nums.length > 0) pageNum = Math.max(...nums) + 1
  }

  const pageRecords: PageRecord[] = []
  const newFileIds: string[] = []

  for (let i = 0; i < files.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, STAGGER_MS))
    }

    const file = files[i]
    const format = EXT_MAP[file.type] ?? 'jpg'
    const key = `pages/${storyId}/${chapterId}/${pageNum}.${format}`

    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })

    const page: PageRecord = {
      id: `p${chapterId}_${pageNum}`,
      chapterId,
      storyId,
      fileId: key,
      pageNumber: pageNum,
      format,
      fileSize: file.size,
    }

    await putJson(kv, KEYS.page(storyId, chapterId, pageNum), page)
    pageRecords.push(page)
    newFileIds.push(key)
    pageNum++
  }

  const existingFileIds: string[] = chapters[chapterIdx].pageFileIds ?? []
  chapters[chapterIdx].pageFileIds = [...existingFileIds, ...newFileIds]
  chapters[chapterIdx].pageCount = chapters[chapterIdx].pageFileIds.length
  await putJson(kv, KEYS.chapters(storyId), chapters)

  return c.json({ pages: pageRecords, totalPages: chapters[chapterIdx].pageCount }, 201)
})

export default app
