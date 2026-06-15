import { Hono } from 'hono'
import type { Env, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)
  const chapter = await getJson<Chapter>(kv, KEYS.chapter(storyId, chapterId))
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
  const chapterKeys = await kv.list({ prefix: `chapter:${storyId}:` })
  const chapterResults = await Promise.all(
    chapterKeys.keys.map(async key => {
      const cid = key.name.split(':').slice(2).join(':')
      return getJson<Chapter>(kv, KEYS.chapter(storyId, cid))
    })
  )
  const chapters = chapterResults.filter((c): c is Chapter => c !== null).sort((a, b) => a.number - b.number)
  return c.json(chapters)
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const body = await c.req.json<Partial<Chapter>>()
  if (!body.storyId || !body.title || body.number === undefined) {
    return c.json({ error: 'storyId, title, number required' }, 400)
  }
  const err = validateStoryId(body.storyId)
  if (err) return c.json({ error: err }, 400)

  const counterKey = KEYS.chapterNextId(body.storyId)
  const nextNum = (parseInt((await kv.get(counterKey)) ?? '0', 10)) + 1
  await kv.put(counterKey, String(nextNum))

  const chapter: Chapter = {
    id: `ch${nextNum}`,
    storyId: body.storyId,
    title: body.title,
    number: body.number,
    pageCount: 0,
    createdAt: Date.now(),
  }

  await putJson(kv, KEYS.chapter(chapter.storyId, chapter.id), chapter)

  return c.json(chapter, 201)
})

app.patch('/:storyId/:chapterId/reorder', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)
  const { newNumber } = await c.req.json<{ newNumber: number }>()

  const chapter = await getJson<Chapter>(kv, KEYS.chapter(storyId, chapterId))
  if (!chapter) return c.json({ error: 'not found' }, 404)

  chapter.number = newNumber
  await putJson(kv, KEYS.chapter(storyId, chapterId), chapter)

  return c.json(chapter)
})

app.delete('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)
  await kv.delete(KEYS.chapter(storyId, chapterId))
  return c.json({ ok: true })
})

export default app
