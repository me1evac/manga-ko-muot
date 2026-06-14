import { Hono } from 'hono'
import type { Env, PageRecord } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { sendPhoto } from '../services/telegram'

const STAGGER_MS = 3000
const MAX_FILES = 70
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EXT_MAP: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const app = new Hono<{ Bindings: Env }>()

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const botToken = c.env.TELEGRAM_BOT_TOKEN
  const chatId = c.env.TELEGRAM_CHAT_ID

  if (!chatId) {
    return c.json({ error: 'TELEGRAM_CHAT_ID not configured' }, 500)
  }

  const body = await c.req.parseBody()
  const storyId = body.storyId as string
  const chapterId = body.chapterId as string
  const raw = body['files']
  const files = Array.isArray(raw) ? raw.filter((f): f is File => f instanceof File) : raw instanceof File ? [raw] : []

  if (!storyId || !chapterId) {
    return c.json({ error: 'storyId and chapterId required' }, 400)
  }

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

  const chapter = await getJson<any>(kv, KEYS.chapter(storyId, chapterId))
  if (!chapter) return c.json({ error: 'chapter not found' }, 404)

  const pageRecords: PageRecord[] = []
  const existingPages = await getJson<number[]>(kv, KEYS.pageList(chapterId)) ?? []
  let pageNum = existingPages.length > 0 ? Math.max(...existingPages) + 1 : 1

  for (let i = 0; i < files.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, STAGGER_MS))
    }

    const file = files[i]
    const format = EXT_MAP[file.type] ?? 'jpg'

    const fileId = await sendPhoto(botToken, chatId, file)

    const page: PageRecord = {
      id: `p${chapterId}_${pageNum}`,
      chapterId,
      storyId,
      fileId,
      pageNumber: pageNum,
      format,
      fileSize: file.size,
    }

    await putJson(kv, KEYS.page(chapterId, pageNum), page)
    pageRecords.push(page)
    existingPages.push(pageNum)
    pageNum++
  }

  await putJson(kv, KEYS.pageList(chapterId), existingPages)

  chapter.pageCount = existingPages.length
  await putJson(kv, KEYS.chapter(storyId, chapterId), chapter)

  return c.json({ pages: pageRecords, totalPages: existingPages.length }, 201)
})

export default app
