import { Hono } from 'hono'
import type { Env, Story } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { validateStoryId } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV
  const storyKeys = await kv.list({ prefix: 'story:' })
  const stories: Story[] = []
  for (const key of storyKeys.keys) {
    const id = key.name.replace('story:', '')
    if (!id || id === 'list') continue
    const s = await getJson<Story>(kv, KEYS.story(id))
    if (s) stories.push(s)
  }
  return c.json(stories)
})

app.get('/:id', async (c) => {
  const kv = c.env.MANGA_KV
  const id = c.req.param('id')
  const err = validateStoryId(id)
  if (err) return c.json({ error: err }, 400)
  const story = await getJson<Story>(kv, KEYS.story(id))
  if (!story) return c.json({ error: 'not found' }, 404)

  const chapterKeys = await kv.list({ prefix: `chapter:${id}:` })
  const chapters = []
  for (const key of chapterKeys.keys) {
    const cid = key.name.split(':').slice(2).join(':')
    const ch = await getJson<any>(kv, KEYS.chapter(id, cid))
    if (ch) chapters.push(ch)
  }
  chapters.sort((a, b) => a.number - b.number)

  return c.json({ story, chapters })
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
  const id = c.req.param('id')
  const err = validateStoryId(id)
  if (err) return c.json({ error: err }, 400)
  await kv.delete(KEYS.story(id))
  return c.json({ ok: true })
})

export default app
