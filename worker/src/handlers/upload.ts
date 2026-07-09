import { Hono } from 'hono'
import type { Env, PageRecord, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'
import { decodeToImageData, encodeImageDataToWebp } from '../utils/imageCompress'

const MAX_FILES = 35
const FILE_SIZE_LIMIT = 15 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EXT_MAP: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function processFile(file: File): Promise<{
  hq: { buffer: ArrayBuffer; type: string; ext: 'jpg' | 'png' | 'webp' }
  lq: ArrayBuffer | null
}> {
  const buffer = await file.arrayBuffer()
  const ext = EXT_MAP[file.type] ?? 'jpg'

  const imageData = await decodeToImageData(buffer, file.type)
  if (imageData) {
    const [hqBuf, lqBuf] = await Promise.all([
      encodeImageDataToWebp(imageData, 80),
      encodeImageDataToWebp(imageData, 15),
    ])
    if (hqBuf) {
      return {
        hq: { buffer: hqBuf, type: 'image/webp', ext: 'webp' },
        lq: lqBuf,
      }
    }
  }

  return {
    hq: { buffer, type: file.type, ext },
    lq: null,
  }
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
  const { hq: { buffer, type, ext }, lq: _lq } = await processFile(file)
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
  const files: File[] = (formData.getAll('files') as any[]).filter((v: any) => v instanceof File)

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
    if (file.size > FILE_SIZE_LIMIT) {
      return c.json({ error: `file too large: ${file.name} (max 15MB)` }, 400)
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
    const { hq, lq } = await processFile(file)
    const pageNum = nextPageNum++
    const hqKey = `pages/${storyId}/${chapterId}/${pageNum}.${hq.ext}`
    const lqKey = `pages/${storyId}/${chapterId}/${pageNum}_lq.${hq.ext}`

    await bucket.put(hqKey, hq.buffer, {
      httpMetadata: { contentType: hq.type },
    })

    if (lq) {
      await bucket.put(lqKey, lq, {
        httpMetadata: { contentType: 'image/webp' },
      })
    }

    newPages.push({
      id: `p${chapterId}_${pageNum}`,
      chapterId,
      storyId,
      fileId: hqKey,
      thumbnailId: lq ? lqKey : undefined,
      pageNumber: pageNum,
      format: hq.ext,
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
