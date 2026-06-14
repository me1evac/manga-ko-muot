export function getBlurDataUrl(size = 20): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#27272a"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function isWebpSupported(): boolean {
  const elem = document.createElement('canvas')
  if (elem.getContext && elem.getContext('2d')) {
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }
  return false
}

export function getConnectionType(): 'slow' | 'medium' | 'fast' {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection
    if (conn) {
      const type = conn.effectiveType as string
      if (type === 'slow-2g' || type === '2g') return 'slow'
      if (type === '3g') return 'medium'
    }
  }
  return 'fast'
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
