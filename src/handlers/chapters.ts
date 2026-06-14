import { Hono } from 'hono'
import type { Env, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  const chapter = await getJson<Chapter>(kv, KEYS.chapter(storyId, chapterId))
  if (!chapter) return c.json({ error: 'not found' }, 404)

  const pageNums = await getJson<number[]>(kv, KEYS.pageList(chapterId)) ?? []
  return c.json({ chapter, pageCount: pageNums.length })
})

app.get('/:storyId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId } = c.req.param()
  const ids = await getJson<string[]>(kv, KEYS.chapterList(storyId)) ?? []
  const chapters: Chapter[] = []
  for (const cid of ids) {
    const ch = await getJson<Chapter>(kv, KEYS.chapter(storyId, cid))
    if (ch) chapters.push(ch)
  }
  chapters.sort((a, b) => a.number - b.number)
  return c.json(chapters)
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const body = await c.req.json<Partial<Chapter>>()
  if (!body.storyId || !body.title || body.number === undefined) {
    return c.json({ error: 'storyId, title, number required' }, 400)
  }

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

  const list = await getJson<string[]>(kv, KEYS.chapterList(chapter.storyId)) ?? []
  list.push(chapter.id)
  await putJson(kv, KEYS.chapterList(chapter.storyId), list)

  return c.json(chapter, 201)
})

app.patch('/:storyId/:chapterId/reorder', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
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
  await kv.delete(KEYS.chapter(storyId, chapterId))

  const list = await getJson<string[]>(kv, KEYS.chapterList(storyId)) ?? []
  await putJson(kv, KEYS.chapterList(storyId), list.filter((id) => id !== chapterId))

  return c.json({ ok: true })
})

export default app
