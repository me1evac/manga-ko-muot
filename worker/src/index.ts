import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import storiesHandler from './handlers/stories'
import chaptersHandler from './handlers/chapters'
import pagesHandler from './handlers/pages'
import uploadHandler from './handlers/upload'
import configHandler from './handlers/config'
import migrateHandler from './handlers/migrate'

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

app.route('/api/stories', storiesHandler)
app.route('/api/chapters', chaptersHandler)
app.route('/api/images', pagesHandler)
app.route('/api/pages', pagesHandler)
app.route('/api/upload', uploadHandler)
app.route('/api/config', configHandler)
app.route('/api/migrate', migrateHandler)

app.get('/api/health', (c) => c.json({ ok: true }))

app.all('*', (c) => c.json({ error: 'not found' }, 404))

export default app
