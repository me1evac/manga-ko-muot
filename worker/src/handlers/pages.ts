import { Hono } from 'hono'
import type { Env, PageRecord } from '../types'
import { KEYS, getJson } from '../store/kv'
import { validateStoryId, validateChapterId } from '../validate'

const app = new Hono<{ Bindings: Env }>()

app.get('/list/:storyId/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { storyId, chapterId } = c.req.param()
  let err = validateStoryId(storyId)
  if (!err) err = validateChapterId(chapterId)
  if (err) return c.json({ error: err }, 400)

  const pagePrefix = `page:${storyId}:${chapterId}:`
  const pageKeys = await kv.list({ prefix: pagePrefix })
  const pageNums = pageKeys.keys
    .map(k => parseInt(k.name.split(':').pop()!, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)

  const pageResults = await Promise.all(
    pageNums.map(num => getJson<PageRecord>(kv, KEYS.page(storyId, chapterId, num)))
  )
  const pages = pageResults.filter(Boolean) as PageRecord[]

  return c.json({ pages, chapterId })
})

app.get('/*', async (c) => {
  const key = c.req.path.replace(/^.*\/images\//, '')
  const object = await c.env.MANGA_BUCKET.get(key)

  if (!object) {
    return c.json({ error: 'not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('ETag', object.httpEtag)

  return new Response(object.body, {
    headers,
  })
})

export default app
