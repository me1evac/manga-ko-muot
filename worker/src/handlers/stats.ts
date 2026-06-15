import { Hono } from 'hono'
import type { Env } from '../types'
import { KEYS } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV

  const [storyKeys, pageKeys] = await Promise.all([
    kv.list({ prefix: 'story:' }),
    kv.list({ prefix: 'page:' }),
  ])

  let chapterCount = 0
  const chapterKeys = await Promise.all(
    storyKeys.keys.map(k => kv.get(KEYS.chapters(k.name.replace('story:', ''))))
  )
  for (const val of chapterKeys) {
    if (val) {
      const chapters = JSON.parse(val)
      chapterCount += (chapters as any[]).length
    }
  }

  return c.json({
    stories: storyKeys.keys.length,
    chapters: chapterCount,
    pages: pageKeys.keys.length,
  })
})

export default app
