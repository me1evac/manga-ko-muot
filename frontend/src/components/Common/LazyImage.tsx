import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: () => void
  thumbnailSrc?: string | null
}

export default function LazyImage({ src, alt, className = '', onLoad, thumbnailSrc }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  const preloaderRef = useRef<HTMLImageElement | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = imgRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    setLoaded(false)
    setDisplaySrc(null)
    if (preloaderRef.current) {
      preloaderRef.current.onload = null
      preloaderRef.current = null
    }
  }, [src])

  useEffect(() => {
    if (!inView || displaySrc) return
    setDisplaySrc(thumbnailSrc ?? src)

    if (thumbnailSrc && thumbnailSrc !== src) {
      const img = new Image()
      preloaderRef.current = img
      img.onload = () => setDisplaySrc(src)
      img.src = src
    }
  }, [inView, thumbnailSrc, src, displaySrc])

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 bg-zinc-800" />}
      {inView && displaySrc && (
        <img
          src={displaySrc}
          alt={alt}
          className={`relative w-full h-full object-contain transition-all duration-500 ${
            loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-100 blur-xl scale-105'
          }`}
          onLoad={() => { setLoaded(true); onLoad?.() }}
          loading="lazy"
        />
      )}
    </div>
  )
}
