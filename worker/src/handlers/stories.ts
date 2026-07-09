import { Hono } from 'hono'
import type { Env, Story, Chapter, PageRecord } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV
  const storyKeys = await kv.list({ prefix: 'story:' })
  const storyResults = await Promise.all(
    storyKeys.keys.map(async key => {
      const id = key.name.replace('story:', '')
      if (!id || id === 'list') return null
      return getJson<Story>(kv, KEYS.story(id))
    })
  )
  const stories = storyResults.filter(Boolean) as Story[]
  return c.json(stories)
})

app.get('/:id', async (c) => {
  const kv = c.env.MANGA_KV
  const id = c.req.param('id')
  const err = validateStoryId(id)
  if (err) return c.json({ error: err }, 400)
  const story = await getJson<Story>(kv, KEYS.story(id))
  if (!story) return c.json({ error: 'not found' }, 404)

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10), 1), 100)
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10), 0)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(id))) ?? []
  const sorted = chapters.sort((a, b) => a.number - b.number)

  return c.json({ story, chapters: sorted.slice(offset, offset + limit), total: sorted.length, offset })
})

app.post('/', async (c) => {
  const kv = c.env.MANGA_KV
  const body = await c.req.json<Partial<Story>>()
  if (!body.id || !body.title) {
    return c.json({ error: 'id and title required' }, 400)
  }
  const err = validateStoryId(body.id)
  if (err) return c.json({ error: err }, 400)

  const existing = await getJson<Story>(kv, KEYS.story(body.id))
  if (existing) return c.json({ error: 'story already exists' }, 409)

  const now = Date.now()
  const story: Story = {
    id: body.id,
    title: body.title,
    coverFileId: body.coverFileId ?? '',
    description: body.description ?? '',
    status: body.status ?? 'ongoing',
    createdAt: now,
    updatedAt: now,
  }

  await putJson(kv, KEYS.story(story.id), story)

  return c.json(story, 201)
})

app.patch('/:id', async (c) => {
  const kv = c.env.MANGA_KV
  const id = c.req.param('id')
  const err = validateStoryId(id)
  if (err) return c.json({ error: err }, 400)
  const story = await getJson<Story>(kv, KEYS.story(id))
  if (!story) return c.json({ error: 'not found' }, 404)

  const body = await c.req.json<Partial<Story>>()
  const updated: Story = {
    ...story,
    ...body,
    id: story.id,
    updatedAt: Date.now(),
  }

  delete (updated as any).createdAt
  await putJson(kv, KEYS.story(id), updated)
  return c.json(updated)
})

app.delete('/:id', async (c) => {
  const kv = c.env.MANGA_KV
  const bucket = c.env.MANGA_BUCKET
  const id = c.req.param('id')
  const err = validateStoryId(id)
  if (err) return c.json({ error: err }, 400)

  const chapters = (await getJson<Chapter[]>(kv, KEYS.chapters(id))) ?? []

  await Promise.all(chapters.map(async (ch) => {
    const pages = (await getJson<PageRecord[]>(kv, KEYS.pages(id, ch.id))) ?? []
    await Promise.all(pages.flatMap(p => {
      const keys = [bucket.delete(p.fileId).catch(() => {})]
      if (p.thumbnailId) keys.push(bucket.delete(p.thumbnailId).catch(() => {}))
      return keys
    }))
    await kv.delete(KEYS.pages(id, ch.id))
  }))
  await kv.delete(KEYS.chapters(id))
  await kv.delete(KEYS.story(id))

  return c.json({ ok: true })
})

export default app
