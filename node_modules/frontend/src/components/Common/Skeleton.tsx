interface SkeletonProps {
  className?: string
  count?: number
}

export default function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton-pulse ${className}`} />
      ))}
    </>
  )
}

export function StoryCardSkeleton() {
  return (
    <div className="bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800">
      <div className="aspect-[3/4] skeleton-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton-pulse w-3/4" />
        <div className="h-3 skeleton-pulse w-1/2" />
      </div>
    </div>
  )
}
