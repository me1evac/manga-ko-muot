import type { Story, Chapter, PageRecord } from '../types'

const KEYS = {
  story: (id: string) => `story:${id}`,
  chapter: (sid: string, cid: string) => `chapter:${sid}:${cid}`,
  chapters: (sid: string) => `chapters:${sid}`,
  pages: (sid: string, cid: string) => `pages:${sid}:${cid}`,
  configPassword: 'config:password',
  chapterNextId: (sid: string) => `config:chapterNextId:${sid}`,
}

async function getJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const val = await kv.get(key)
  return val ? (JSON.parse(val) as T) : null
}

function putJson(kv: KVNamespace, key: string, val: unknown): Promise<void> {
  return kv.put(key, JSON.stringify(val))
}

export { KEYS, getJson, putJson }
export type { Story, Chapter, PageRecord }
