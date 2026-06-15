import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function hideTsExtension(): Plugin {
  return {
    name: 'hide-ts-extension',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        const isSrc = url.startsWith('/src/') || url.startsWith('/@fs/')
        if (!isSrc) return next()

        const extMatch = url.match(/\.(tsx?|jsx?)(?=\?|$)/)
        if (!extMatch) return next()
        const [, ext] = extMatch

        // Rewrite .ts/.tsx -> .js/.jsx in the URL so IDM never sees .ts
        if (ext === 'ts' || ext === 'tsx') {
          req.url = url.replace(/\.tsx?/, (m) => m === '.tsx' ? '.jsx' : '.js')
        }

        // Wrap res.end to replace .ts/.tsx -> .js/.jsx in import URLs within the
        // final JavaScript response (Vite resolves imports AFTER all transforms)
        const originalEnd = res.end.bind(res)
        const chunks: Buffer[] = []

        res.write = function (chunk) {
          if (chunk != null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          return true
        }

        res.end = function (chunk, encoding, callback) {
          if (chunk != null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          if (chunks.length === 0) return originalEnd(chunk, encoding, callback)

          let body = Buffer.concat(chunks).toString('utf8')
          body = body.replace(
            /(['"])((?:\/|\.\/|\.\.\/)[^'"]*)\.(ts|tsx)(['"])/g,
            (_m, open, path, e, close) => `${open}${path}.${e === 'tsx' ? 'jsx' : 'js'}${close}`,
          )
          const buf = Buffer.from(body, 'utf8')
          if (!res.headersSent) res.setHeader('Content-Length', buf.length)
          return originalEnd(buf, encoding, callback)
        }

        next()
      })
    },
    resolveId(id, importer) {
      if (id.includes('node_modules')) return
      if (id.includes('/.')) return
      if (id.endsWith('.jsx')) {
        return this.resolve(id.slice(0, -4) + '.tsx', importer, { skipSelf: true })
      }
      if (id.endsWith('.js') && !id.endsWith('.jsx')) {
        return this.resolve(id.slice(0, -3) + '.ts', importer, { skipSelf: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), hideTsExtension()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  },
  build: {
    sourcemap: false,
  },
})
