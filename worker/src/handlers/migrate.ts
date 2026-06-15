import { Hono } from 'hono'
import type { Env, Chapter } from '../types'
import { KEYS, getJson, putJson } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV
  const log: string[] = []

  await kv.delete('story:list')
  log.push('Deleted story:list')

  const storyKeys = await kv.list({ prefix: 'story:' })
  const storyIds: string[] = []
  for (const key of storyKeys.keys) {
    const id = key.name.replace('story:', '')
    if (id && id !== 'list') storyIds.push(id)
  }
  log.push(`Found ${storyIds.length} stories`)

  for (const sid of storyIds) {
    await kv.delete(`chapter:list:${sid}`)
    log.push(`Deleted chapter:list:${sid}`)
    await kv.delete(`config:chapterNextId:${sid}`)
    log.push(`Deleted config:chapterNextId:${sid}`)
  }

  const pageKeys = await kv.list({ prefix: 'page:' })
  log.push(`Found ${pageKeys.keys.length} page- keys`)

  const oldPages: { key: string; chapterId: string; pageNum: number }[] = []
  const listKeys: string[] = []

  for (const entry of pageKeys.keys) {
    const parts = entry.name.split(':')
    if (parts.length === 3 && parts[1] === 'list') {
      listKeys.push(entry.name)
    } else if (parts.length === 3) {
      const pageNum = parseInt(parts[2], 10)
      if (!isNaN(pageNum)) {
        oldPages.push({ key: entry.name, chapterId: parts[1], pageNum })
      }
    } else if (parts.length === 4 && parts[1] === 'list') {
      listKeys.push(entry.name)
    }
  }

  for (const lk of listKeys) {
    await kv.delete(lk)
    log.push(`Deleted list key: ${lk}`)
  }

  let migrated = 0
  let skipped = 0
  for (const old of oldPages) {
    const candidates: string[] = []
    for (const sid of storyIds) {
      const ch = await kv.get(`chapter:${sid}:${old.chapterId}`)
      if (ch) candidates.push(sid)
    }

    if (candidates.length === 1) {
      const sid = candidates[0]
      const val = await kv.get(old.key)
      if (val) {
        const newKey = `page:${sid}:${old.chapterId}:${old.pageNum}`
        await kv.put(newKey, val)
        await kv.delete(old.key)
        migrated++
        log.push(`Migrated: ${old.key} -> ${newKey}`)
      }
    } else {
      skipped++
      log.push(`Skipped (${candidates.length} matches): ${old.key}`)
    }
  }

  return c.json({ migrated, skipped, deletedLists: listKeys.length, log })
})

app.get('/chapters-to-list', async (c) => {
  const kv = c.env.MANGA_KV
  const log: string[] = []

  const storyKeys = await kv.list({ prefix: 'story:' })
  const storyIds: string[] = []
  for (const key of storyKeys.keys) {
    const id = key.name.replace('story:', '')
    if (id && id !== 'list') storyIds.push(id)
  }
  log.push(`Found ${storyIds.length} stories`)

  let totalChapters = 0
  let totalDeleted = 0

  for (const sid of storyIds) {
    const chapterKeys = await kv.list({ prefix: `chapter:${sid}:` })
    const individualChapters: { key: string; chapter: Chapter }[] = []

    for (const entry of chapterKeys.keys) {
      const ch = await getJson<Chapter>(kv, entry.name)
      if (ch) individualChapters.push({ key: entry.name, chapter: ch })
    }

    if (individualChapters.length === 0) continue

    const chaptersList = individualChapters.map(e => e.chapter).sort((a, b) => a.number - b.number)
    await putJson(kv, KEYS.chapters(sid), chaptersList)
    log.push(`Created chapters:${sid} with ${chaptersList.length} chapters`)

    for (const { key } of individualChapters) {
      await kv.delete(key)
      totalDeleted++
    }
    totalChapters += chaptersList.length
    log.push(`Deleted ${individualChapters.length} individual chapter keys for ${sid}`)
  }

  return c.json({ totalStories: storyIds.length, totalChapters, totalDeleted, log })
})

export default app
