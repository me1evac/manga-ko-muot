import { Hono } from 'hono'
import type { Env } from '../types'
import { KEYS } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV
  const bucket = c.env.MANGA_BUCKET

  const log: string[] = []

  const r2Objects = await bucket.list()
  const r2Count = r2Objects.objects.length
  log.push(`Found ${r2Count} R2 objects`)
  const deletedR2 = r2Objects.objects.length
  await Promise.all(r2Objects.objects.map(o => bucket.delete(o.key).catch(() => {})))
  log.push(`Deleted ${deletedR2} R2 objects`)

  const pageKeys = await kv.list({ prefix: 'pages:' })
  const pageCount = pageKeys.keys.length
  await Promise.all(pageKeys.keys.map(k => kv.delete(k.name)))
  log.push(`Deleted ${pageCount} pages KV keys`)

  const storyKeys = await kv.list({ prefix: 'story:' })
  const storyIds = storyKeys.keys
    .map(k => k.name.replace('story:', ''))
    .filter(id => id && id !== 'list')

  for (const sid of storyIds) {
    await kv.put(KEYS.chapters(sid), '[]')
  }
  log.push(`Reset ${storyIds.length} stories (chapters cleared)`)

  return c.json({
    cleaned: true,
    deletedR2Objects: deletedR2,
    deletedPageKeys: pageCount,
    resetStories: storyIds.length,
    log,
  })
})

export default app
