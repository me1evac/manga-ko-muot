import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import storiesHandler from './handlers/stories'
import chaptersHandler from './handlers/chapters'
import pagesHandler from './handlers/pages'
import uploadHandler from './handlers/upload'
import configHandler from './handlers/config'
import migrateHandler from './handlers/migrate'
import statsHandler from './handlers/stats'

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['*'],
  exposeHeaders: ['*'],
}))

app.use('/api/stories/*', async (c, next) => {
  await next()
  if (c.req.method === 'GET') c.header('Cache-Control', 'public, max-age=10, s-maxage=30')
})
app.use('/api/chapters/*', async (c, next) => {
  await next()
  if (c.req.method === 'GET') c.header('Cache-Control', 'public, max-age=10, s-maxage=30')
})
app.use('/api/pages/*', async (c, next) => {
  await next()
  if (c.req.method === 'GET') c.header('Cache-Control', 'public, max-age=10, s-maxage=30')
})

app.route('/api/stories', storiesHandler)
app.route('/api/chapters', chaptersHandler)
app.route('/api/images', pagesHandler)
app.route('/api/pages', pagesHandler)
app.route('/api/upload', uploadHandler)
app.route('/api/config', configHandler)
app.route('/api/migrate', migrateHandler)
app.route('/api/stats', statsHandler)

app.get('/api/health', (c) => c.json({ ok: true }))

app.all('*', (c) => c.json({ error: 'not found' }, 404))

export default app
