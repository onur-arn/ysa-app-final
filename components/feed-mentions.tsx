"use client"

import { ProfileLink } from "@/components/profile/profile-link"
import { type ReactNode } from "react"
import { useApp } from "@/components/providers/app-context"
import { MENTION_GROUPS } from "@/lib/constants"
import { useMembers } from "@/lib/data/hooks"
import { isDeleted } from "@/lib/members"
import { findMentions, type MentionTarget } from "@/lib/mentions"
import { cn } from "@/lib/utils"

type Tag = { color?: string; mine?: boolean; id?: string }

/** Everything that can be tagged right now: members, stations, position groups. */
export function useMentionTargets(): MentionTarget<Tag & { kind: string }>[] {
  const { data: members = [] } = useMembers()
  const { stations, station, me } = useApp()
  return [
    ...MENTION_GROUPS.map((g) => ({ label: g.label, value: { kind: "group", mine: g.positions.includes(me.position ?? "") } })),
    ...stations.map((s) => ({ label: s.name, value: { kind: "station", color: s.color, mine: s.id === me.station_id } })),
    ...members.filter((m) => !isDeleted(m) && m.status === "active")
      .map((m) => ({ label: m.full_name, value: { kind: "member", id: m.id, color: station(m.station_id)?.color, mine: m.id === me.id } })),
  ]
}

/** Post text with every "@mention" highlighted (members and stations in their station colour). */
export function FeedMentionText({ text }: { text: string }) {
  const targets = useMentionTargets()
  if (!text.includes("@")) return <>{text}</>
  const chars = [...text]
  const parts: ReactNode[] = []
  let last = 0
  for (const h of findMentions(text, targets)) {
    parts.push(chars.slice(last, h.start).join(""))
    const color = h.target.value.color ?? "188 57% 48%"
    const tag = (
      <span className={cn("rounded-md px-1 font-semibold", h.target.value.mine && "ring-1 ring-current")} style={{ color: `hsl(${color})`, backgroundColor: `hsl(${color} / 0.12)` }}>
        @{h.target.label}
      </span>
    )
    // a tagged member opens their profile
    parts.push(h.target.value.kind === "member" ? <ProfileLink key={h.start} id={h.target.value.id}>{tag}</ProfileLink> : <span key={h.start}>{tag}</span>)
    last = h.end
  }
  parts.push(chars.slice(last).join(""))
  return <>{parts}</>
}

/** Live hint under the composer: who will be tagged. */
export function MentionPreview({ text }: { text: string }) {
  const targets = useMentionTargets()
  const hits = text.includes("@") ? findMentions(text, targets) : []
  const labels = [...new Set(hits.map((h) => h.target.label))]
  if (!labels.length) return null
  return (
    <p className="-mt-2 text-xs text-muted-foreground">
      Etiketlenecek: {labels.map((l, i) => <span key={l} className="font-semibold text-primary">{i ? ", " : ""}@{l}</span>)}
    </p>
  )
}
