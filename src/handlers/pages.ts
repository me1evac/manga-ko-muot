import { Hono } from 'hono'
import type { Env, PageRecord } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'
import { getFileInfo, getFileUrl } from '../services/telegram'

const app = new Hono<{ Bindings: Env }>()

app.get('/list/:chapterId', async (c) => {
  const kv = c.env.MANGA_KV
  const { chapterId } = c.req.param()

  const pageNums = await getJson<number[]>(kv, KEYS.pageList(chapterId)) ?? []
  const pages: PageRecord[] = []

  for (const num of pageNums.sort((a, b) => a - b)) {
    const page = await getJson<PageRecord>(kv, KEYS.page(chapterId, num))
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
    const { url, contentType } = JSON.parse(cached)
    return c.redirect(url, 302)
  }

  try {
    const { filePath } = await getFileInfo(botToken, fileId)
    const url = getFileUrl(botToken, filePath)

    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }

    await kv.put(
      cacheKey,
      JSON.stringify({ url, contentType: contentTypeMap[ext] ?? 'image/jpeg' }),
      { expirationTtl: 86400 }
    )

    return c.redirect(url, 302)
  } catch (e: any) {
    return c.json({ error: e.message }, 502)
  }
})

export default app
