import { Hono } from 'hono'
import type { Env, PageRecord } from '../types'
import { KEYS, getJson } from '../store/kv'
import { getFileInfo, getFileUrl } from '../services/telegram'
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

  const pages: PageRecord[] = []
  for (const num of pageNums) {
    const page = await getJson<PageRecord>(kv, KEYS.page(storyId, chapterId, num))
    if (page) pages.push(page)
  }

  return c.json({ pages, chapterId })
})

app.get('/:fileId', async (c) => {
  const kv = c.env.MANGA_KV
  const { fileId } = c.req.param()
  const botToken = c.env.TELEGRAM_BOT_TOKEN

  const cacheKey = `image:${fileId}`
  const cached = await kv.get(cacheKey, { type: 'text' })
  if (cached) {
    const { url } = JSON.parse(cached)
    return c.redirect(url, 302)
  }

  try {
    const { filePath } = await getFileInfo(botToken, fileId)
    const url = getFileUrl(botToken, filePath)

    await kv.put(
      cacheKey,
      JSON.stringify({ url, contentType: 'image/jpeg' }),
      { expirationTtl: 86400 }
    )

    return c.redirect(url, 302)
  } catch (e: any) {
    return c.json({ error: e.message }, 502)
  }
})

export default app
