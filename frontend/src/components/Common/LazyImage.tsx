import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: () => void
}

export default function LazyImage({ src, alt, className = '', onLoad }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
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
  }, [src])

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      {inView && (
        <img
          src={src}
          alt={alt}
          className={`relative w-full h-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            setLoaded(true)
            onLoad?.()
          }}
          loading="lazy"
        />
      )}
    </div>
  )
}
