"use client"

import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { useOnline } from "@/lib/realtime/hub"
import { cn, initialsOf } from "@/lib/utils"

export function Avatar({
  name,
  photoUrl,
  stationId,
  size = 44,
  online,
  className,
}: {
  name: string | null | undefined
  photoUrl?: string | null
  stationId?: string | null
  size?: number
  online?: boolean
  className?: string
}) {
  const { station } = useApp()
  const color = station(stationId)?.color ?? "188 57% 48%"
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name ?? ""} className="size-full rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full font-heading font-bold text-white" style={{ backgroundColor: `hsl(${color})`, fontSize: size * 0.36 }}>
          {initialsOf(name)}
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 rounded-full border-2 border-card bg-emerald-500" style={{ width: Math.max(9, size * 0.27), height: Math.max(9, size * 0.27) }} />}
    </span>
  )
}

/** Avatar of a member by id, with the live "online" dot */
export function MemberAvatar({ id, size = 44, className, showOnline = true }: { id: string | null | undefined; size?: number; className?: string; showOnline?: boolean }) {
  const member = useMemberMap()
  const online = useOnline(id)
  const m = member(id)
  return <Avatar name={m?.full_name ?? "?"} photoUrl={m?.photo_url} stationId={m?.station_id} size={size} className={className} online={showOnline && online} />
}

export function AvatarStack({ ids, max = 4, size = 26 }: { ids: string[]; max?: number; size?: number }) {
  return (
    <span className="flex items-center">
      {ids.slice(0, max).map((id, i) => (
        <span key={id} className="rounded-full ring-2 ring-card" style={{ marginLeft: i === 0 ? 0 : -size / 3 }}>
          <MemberAvatar id={id} size={size} showOnline={false} />
        </span>
      ))}
      {ids.length > max && (
        <span className="flex items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground ring-2 ring-card" style={{ width: size, height: size, marginLeft: -size / 3 }}>
          +{ids.length - max}
        </span>
      )}
    </span>
  )
}
