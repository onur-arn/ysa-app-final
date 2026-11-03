"use client"

import { Check, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { MemberAvatar } from "@/components/avatar"
import { useApp } from "@/components/providers/app-context"
import { useMembers } from "@/lib/data/hooks"
import { isDeleted } from "@/lib/members"
import { useI18n } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

/** Searchable member selector. `allOption` adds the "Tüm ekip" row used by tasks. */
export function MemberPicker({
  value,
  onChange,
  multiple = true,
  exclude = [],
  stationFilter,
  allOption,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  exclude?: string[]
  stationFilter?: string | null
  allOption?: { selected: boolean; onSelect: () => void }
}) {
  const { data: members = [] } = useMembers()
  const { station } = useApp()
  const { t } = useI18n()
  const [q, setQ] = useState("")

  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr")
    return members.filter(
      (m) => !isDeleted(m) && !exclude.includes(m.id) && (!stationFilter || m.station_id === stationFilter) &&
        (!s || m.full_name.toLocaleLowerCase("tr").includes(s) || (m.position ?? "").toLocaleLowerCase("tr").includes(s)),
    )
  }, [members, q, exclude, stationFilter])

  const toggle = (id: string) => onChange(multiple ? (value.includes(id) ? value.filter((x) => x !== id) : [...value, id]) : value[0] === id ? [] : [id])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.searchMember")} className="h-11 w-full rounded-2xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border p-1">
        {allOption && (
          <button type="button" onClick={allOption.onSelect} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 text-left", allOption.selected ? "bg-primary/10" : "hover:bg-secondary")}>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary"><Users className="size-4" /></span>
            <span className="flex-1 text-sm font-semibold text-foreground">{t("tasks.wholeTeam")}</span>
            {allOption.selected && <Check className="size-4 text-primary" />}
          </button>
        )}
        {list.map((m) => {
          const on = value.includes(m.id)
          return (
            <button key={m.id} type="button" onClick={() => toggle(m.id)} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 text-left", on ? "bg-primary/10" : "hover:bg-secondary")}>
              <MemberAvatar id={m.id} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{m.full_name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{m.position ?? station(m.station_id)?.name}</span>
              </span>
              <span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="size-3" />}</span>
            </button>
          )
        })}
        {list.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{t("common.noResults")}</p>}
      </div>
    </div>
  )
}
