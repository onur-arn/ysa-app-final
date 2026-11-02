export default function Loading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4" aria-busy>
      <div className="h-11 animate-pulse rounded-2xl bg-secondary" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="size-11 animate-pulse rounded-full bg-secondary" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  )
}
