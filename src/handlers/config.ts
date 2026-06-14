import { Hono } from 'hono'
import type { Env } from '../types'
import { KEYS } from '../store/kv'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const kv = c.env.MANGA_KV
  const password = await kv.get(KEYS.configPassword)
  return c.json({
    hasPassword: !!password,
    passwordSet: !!password,
  })
})

app.get('/password', async (c) => {
  const kv = c.env.MANGA_KV
  const password = await kv.get(KEYS.configPassword)
  return c.json({ password: password ?? c.env.ADMIN_PASSWORD })
})

app.patch('/password', async (c) => {
  const kv = c.env.MANGA_KV
  const { password } = await c.req.json<{ password: string }>()
  if (!password || password.length < 4) {
    return c.json({ error: 'password must be at least 4 characters' }, 400)
  }
  await kv.put(KEYS.configPassword, password)
  return c.json({ ok: true })
})

export default app
