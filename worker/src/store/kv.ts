import type { Story, Chapter, PageRecord } from '../types'

const KEYS = {
  story: (id: string) => `story:${id}`,
  storyList: 'story:list',
  chapter: (sid: string, cid: string) => `chapter:${sid}:${cid}`,
  chapterList: (sid: string) => `chapter:list:${sid}`,
  page: (sid: string, cid: string, num: number) => `page:${sid}:${cid}:${num}`,
  pageList: (sid: string, cid: string) => `page:list:${sid}:${cid}`,
  configPassword: 'config:password',
  storyNextId: 'config:storyNextId',
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
