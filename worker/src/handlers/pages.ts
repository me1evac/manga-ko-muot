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

  const pages = (await getJson<PageRecord[]>(kv, KEYS.pages(storyId, chapterId))) ?? []
  return c.json({ pages, chapterId })
})

app.get('/*', async (c) => {
  const key = c.req.path.replace(/^.*\/images\//, '')
  const publicUrl = `${c.env.R2_PUBLIC_URL}/${key}`

  return new Response(null, {
    status: 302,
    headers: {
      'Location': publicUrl,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

export default app
