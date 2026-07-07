import { Hono } from 'hono'
import type { Env, PageRecord } from '../types'
import { KEYS, getJson } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV

  const storyKeys = await kv.list({ prefix: 'story:' })
  const storyIds = storyKeys.keys
    .map(k => k.name.replace('story:', ''))
    .filter(id => id && id !== 'list')

  let chapterCount = 0
  let pageCount = 0

  await Promise.all(storyIds.map(async (sid) => {
    const chapters = await getJson<any[]>(kv, KEYS.chapters(sid))
    if (chapters) {
      chapterCount += chapters.length
    }
    const pageKeys = await kv.list({ prefix: `pages:${sid}:` })
    await Promise.all(pageKeys.keys.map(async (k) => {
      const pages = await getJson<PageRecord[]>(kv, k.name)
      if (pages) pageCount += pages.length
    }))
  }))

  return c.json({
    stories: storyIds.length,
    chapters: chapterCount,
    pages: pageCount,
  })
})

export default app
