import { useEffect, useRef } from 'react'
import { getConnectionType } from '../utils/image'

export function usePrefetch(urls: string[], enabled = true) {
  const prefetched = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || urls.length === 0) return

    const conn = getConnectionType()
    const limit = conn === 'slow' ? 2 : conn === 'medium' ? 4 : 6

    const toPrefetch = urls
      .filter((u) => !prefetched.current.has(u))
      .slice(0, limit)

    if (toPrefetch.length === 0) return

    const controller = new AbortController()

    toPrefetch.forEach((url) => {
      prefetched.current.add(url)
      fetch(url, {
        signal: controller.signal,
        priority: 'low',
      }).catch(() => {})
    })

    return () => controller.abort()
  }, [urls, enabled])
}
