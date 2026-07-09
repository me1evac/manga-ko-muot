import { Hono } from 'hono'
import type { Env, Chapter, PageRecord } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/:storyId/ids', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId } = c.req.param()
  const err = validateStoryId(storyId)
  if (err) return c.json({ error: err }, 400)
  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const ids = chapters.sort((a, b) => a.number - b.number).map(ch => ({
    id: ch.id,
    title: ch.title,
    number: ch.number,
  }))
  return c.json({ chapters: ids })
})

app.get('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)
  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const chapter = chapters.find(ch => ch.id === chapterId)
  if (!chapter) return c.json({ error: 'not found' }, 404)

  const pages = (await getJson<PageRecord[]>(kv, KEYS.pages(storyId, chapterId))) ?? []
  return c.json({ chapter, pageCount: pages.length })
})

app.get('/:storyId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId } = c.req.param()
  const err = validateStoryId(storyId)
  if (err) return c.json({ error: err }, 400)
  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  return c.json(chapters.sort((a, b) => a.number - b.number))
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const body = await c.req.json<Partial<Chapter>>()
  if (!body.storyId || !body.title || body.number === undefined) {
    return c.json({ error: 'storyId, title, number required' }, 400)
  }
  const err = validateStoryId(body.storyId)
  if (err) return c.json({ error: err }, 400)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(body.storyId))) ?? []
  const chapterNumber = body.number

  if (chapters.some(ch => ch.number === chapterNumber)) {
    return c.json({ error: 'chapter already exists' }, 409)
  }

  const existingIds = new Set(chapters.map(ch => ch.id))
  let chapterId = `ch${chapterNumber}`
  if (existingIds.has(chapterId)) {
    chapterId = `ch${chapterNumber}_${Math.random().toString(36).slice(2, 8)}`
  }

  const chapter: Chapter = {
    id: chapterId,
    storyId: body.storyId,
    title: body.title,
    number: chapterNumber,
    pageCount: 0,
    createdAt: Date.now(),
  }

  chapters.push(chapter)
  await putJson(kv, KEYS.chapters(body.storyId), chapters)

  return c.json(chapter, 201)
})

app.patch('/:storyId/:chapterId/reorder', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)
  const { newNumber } = await c.req.json<{ newNumber: number }>()

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const idx = chapters.findIndex(ch => ch.id === chapterId)
  if (idx === -1) return c.json({ error: 'not found' }, 404)

  chapters[idx].number = newNumber
  await putJson(kv, KEYS.chapters(storyId), chapters)

  return c.json(chapters[idx])
})

app.patch('/:storyId/swap', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId } = c.req.param()
  const { chapterId1, chapterId2 } = await c.req.json<{ chapterId1: string; chapterId2: string }>()
  const err = validateStoryId(storyId)
  if (err) return c.json({ error: err }, 400)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const ch1 = chapters.find(ch => ch.id === chapterId1)
  const ch2 = chapters.find(ch => ch.id === chapterId2)
  if (!ch1 || !ch2) return c.json({ error: 'chapter not found' }, 404)

  const tmp = ch1.number
  ch1.number = ch2.number
  ch2.number = tmp
  await putJson(kv, KEYS.chapters(storyId), chapters)

  return c.json({ ok: true })
})

app.delete('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const bucket = c.env.MANGA_BUCKET
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const idx = chapters.findIndex(ch => ch.id === chapterId)
  if (idx === -1) return c.json({ error: 'not found' }, 404)

  chapters.splice(idx, 1)
  await putJson(kv, KEYS.chapters(storyId), chapters)

  const pages = (await getJson<PageRecord[]>(kv, KEYS.pages(storyId, chapterId))) ?? []
  await Promise.all(pages.flatMap(p => {
    const keys = [bucket.delete(p.fileId).catch(() => {})]
    if (p.thumbnailId) keys.push(bucket.delete(p.thumbnailId).catch(() => {}))
    return keys
  }))
  await kv.delete(KEYS.pages(storyId, chapterId))

  return c.json({ ok: true })
})

export default app
