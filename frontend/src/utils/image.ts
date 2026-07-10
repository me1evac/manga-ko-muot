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
