"use client"

import { Building2, Users } from "lucide-react"
import { useMemo, useRef, useState, type ReactNode } from "react"
import { MemberAvatar } from "@/components/avatar"
import { useApp } from "@/components/providers/app-context"
import { Textarea } from "@/components/ui/sheet"
import { MENTION_GROUPS } from "@/lib/constants"
import { useMembers } from "@/lib/data/hooks"
import { isDeleted } from "@/lib/members"
import { cn } from "@/lib/utils"

/** What a feed post pings: people, whole stations, and position groups (Başkanlar…). */
export type FeedMentions = { mentions: string[]; mention_stations: string[]; mention_groups: string[] }
export const NO_MENTIONS: FeedMentions = { mentions: [], mention_stations: [], mention_groups: [] }

type Candidate = { kind: "member" | "station" | "group"; id: string; label: string; sub?: string; color?: string }

const QUERY = /(^|\s)@([\p{L}\p{M}. ]{0,30})$/u
const norm = (s: string) => s.toLocaleLowerCase("tr")

/** Textarea with "@" autocomplete over groups, stations and members. */
export function MentionTextarea({ value, onChange, picked, onPick, className, placeholder }: {
  value: string
  onChange: (v: string) => void
  picked: Candidate[]
  onPick: (list: Candidate[]) => void
  className?: string
  placeholder?: string
}) {
  const { data: members = [] } = useMembers()
  const { stations, station, me } = useApp()
  const [query, setQuery] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const candidates = useMemo(() => {
    if (query === null) return []
    const q = norm(query.trim())
    const groups: Candidate[] = MENTION_GROUPS.filter((g) => norm(g.label).includes(q)).map((g) => ({ kind: "group", id: g.id, label: g.label }))
    const sts: Candidate[] = stations.filter((s) => norm(s.name).includes(q) || norm(s.short).includes(q))
      .map((s) => ({ kind: "station", id: s.id, label: s.name, color: s.color }))
    const people: Candidate[] = members.filter((m) => !isDeleted(m) && m.status === "active" && m.id !== me.id && norm(m.full_name).includes(q))
      .map((m) => ({ kind: "member", id: m.id, label: m.full_name, sub: station(m.station_id)?.short, color: station(m.station_id)?.color }))
    return (q ? [...groups, ...sts, ...people] : [...groups.slice(0, 3), ...sts.slice(0, 3), ...people.slice(0, 2)]).slice(0, 8)
  }, [query, members, stations, station, me.id])

  function change(v: string) {
    onChange(v)
    const caret = ref.current?.selectionStart ?? v.length
    const match = QUERY.exec(v.slice(0, caret))
    setQuery(match ? match[2] : null)
  }

  function pick(c: Candidate) {
    const caret = ref.current?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([\p{L}\p{M}. ]{0,30})$/u, `@${c.label} `)
    onChange(before + value.slice(caret))
    if (!picked.some((x) => x.kind === c.kind && x.id === c.id)) onPick([...picked, c])
    setQuery(null)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(before.length, before.length)
    })
  }

  return (
    <div className="relative">
      <Textarea ref={ref} value={value} onChange={(e) => change(e.target.value)} onBlur={() => { setTimeout(() => setQuery(null), 150) }} placeholder={placeholder} className={className} />
      {candidates.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-2xl">
          {candidates.map((c) => (
            <button key={`${c.kind}:${c.id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-secondary">
              {c.kind === "member" ? <MemberAvatar id={c.id} size={30} showOnline={false} />
                : (
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: c.color ? `hsl(${c.color} / 0.15)` : undefined, color: c.color ? `hsl(${c.color})` : undefined }}>
                    {c.kind === "station" ? <Building2 className="size-4" /> : <Users className="size-4 text-primary" />}
                  </span>
                )}
              <span className="flex-1 truncate text-sm font-semibold" style={c.color && c.kind === "member" ? { color: `hsl(${c.color})` } : undefined}>{c.label}</span>
              <span className="text-[11px] text-muted-foreground">{c.kind === "member" ? c.sub : c.kind === "station" ? "İstasyon" : "Grup"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Keeps only the mentions still present in the text, split by kind for the posts row. */
export function collectMentions(text: string, picked: Candidate[]): FeedMentions {
  const kept = picked.filter((c) => text.includes(`@${c.label}`))
  return {
    mentions: kept.filter((c) => c.kind === "member").map((c) => c.id),
    mention_stations: kept.filter((c) => c.kind === "station").map((c) => c.id),
    mention_groups: kept.filter((c) => c.kind === "group").map((c) => c.id),
  }
}
export type { Candidate as MentionCandidate }

/** Post text with every "@mention" highlighted (members and stations in their station colour). */
export function FeedMentionText({ text, m }: { text: string; m: Partial<FeedMentions> }) {
  const { data: members = [] } = useMembers()
  const { station, me } = useApp()
  const tags: { label: string; color?: string; mine?: boolean }[] = [
    ...(m.mentions ?? []).map((id) => members.find((x) => x.id === id)).filter((x) => !!x)
      .map((x) => ({ label: x!.full_name, color: station(x!.station_id)?.color, mine: x!.id === me.id })),
    ...(m.mention_stations ?? []).map((id) => station(id)).filter((s) => !!s).map((s) => ({ label: s!.name, color: s!.color, mine: s!.id === me.station_id })),
    ...(m.mention_groups ?? []).map((id) => MENTION_GROUPS.find((g) => g.id === id)).filter((g) => !!g)
      .map((g) => ({ label: g!.label, mine: g!.positions.includes(me.position ?? "") })),
  ]
  if (!tags.length) return <>{text}</>
  const byLabel = new Map(tags.map((x) => [x.label, x]))
  const labels = [...byLabel.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(`@(${labels.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g")
  const parts: ReactNode[] = []
  let last = 0
  for (const x of text.matchAll(re)) {
    parts.push(text.slice(last, x.index))
    const tag = byLabel.get(x[1])!
    const color = tag.color ?? "188 57% 48%"
    parts.push(
      <span key={x.index} className={cn("rounded-md px-1 font-semibold", tag.mine && "ring-1 ring-current")} style={{ color: `hsl(${color})`, backgroundColor: `hsl(${color} / 0.12)` }}>
        @{x[1]}
      </span>,
    )
    last = x.index! + x[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
