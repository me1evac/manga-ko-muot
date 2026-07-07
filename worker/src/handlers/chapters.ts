import { Hono } from 'hono'
import type { Env, Chapter } from '../types'
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

  const pagePrefix = `page:${storyId}:${chapterId}:`
  const pageKeys = await kv.list({ prefix: pagePrefix })
  return c.json({ chapter, pageCount: pageKeys.keys.length })
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

  const counterKey = KEYS.chapterNextId(body.storyId)
  const nextNum = (parseInt((await kv.get(counterKey)) ?? '0', 10)) + 1
  await kv.put(counterKey, String(nextNum))

  const chapter: Chapter = {
    id: `ch${nextNum}`,
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

app.delete('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(storyId))) ?? []
  const idx = chapters.findIndex(ch => ch.id === chapterId)
  if (idx === -1) return c.json({ error: 'not found' }, 404)

  chapters.splice(idx, 1)
  await putJson(kv, KEYS.chapters(storyId), chapters)

  return c.json({ ok: true })
})

export default app
