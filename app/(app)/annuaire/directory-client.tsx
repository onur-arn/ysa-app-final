"use client"

import { Search, Trophy, Users } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { MemberAvatar } from "@/components/avatar"
import { ProfileSheet } from "@/components/profile/profile-sheet"
import { Card, Chips, EmptyState, Segmented } from "@/components/ui/misc"
import { useApp } from "@/components/providers/app-context"
import { useMembers } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { levelOf } from "@/lib/levels"

export function DirectoryClient() {
  const { t } = useI18n()
  const { me, stations, station } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const { data: members = [] } = useMembers()
  const [tab, setTab] = useState<"list" | "ranking">("list")
  const [q, setQ] = useState("")
  const [st, setSt] = useState("all")
  const [open, setOpen] = useState<string | null>(params.get("member"))

  useEffect(() => setOpen(params.get("member")), [params])

  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr")
    return members.filter((p) => (st === "all" || p.station_id === st) && (!s || [p.full_name, p.position, p.hometown, p.station_id].some((x) => x?.toLocaleLowerCase("tr").includes(s))))
  }, [members, q, st])

  const ranking = [...list].sort((a, b) => b.points - a.points).slice(0, 50)
  const letters = useMemo(() => {
    const map = new Map<string, typeof list>()
    for (const p of [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"))) {
      const l = (p.full_name.charAt(0) || "#").toLocaleUpperCase("tr")
      map.set(l, [...(map.get(l) ?? []), p])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "tr"))
  }, [list])

  function close() {
    setOpen(null)
    if (params.get("member")) router.replace("/annuaire")
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("directory.searchMember")} className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <Chips value={st} onChange={setSt} options={[{ id: "all", label: `${t("common.all")} · ${members.length}` }, ...stations.map((s) => ({ id: s.id, label: s.city, color: s.color }))]} />
      <Segmented value={tab} onChange={setTab} layoutId="dir-tab" options={[
        { id: "list", label: <span className="flex items-center gap-1.5"><Users className="size-4" />{t("directory.members")}</span> },
        { id: "ranking", label: <span className="flex items-center gap-1.5"><Trophy className="size-4" />{t("points.ranking")}</span> },
      ]} />

      {tab === "list" ? (
        <>
          <p className="px-1 text-xs text-muted-foreground">{list.length} {t("directory.memberCount")}</p>
          {list.length === 0 ? <EmptyState icon={Users} title={t("directory.noMember")} /> : (
            <div className="-mx-4 flex flex-col">
              {letters.map(([letter, people]) => (
                <div key={letter}>
                  {/* v1 style: sticky letter header */}
                  <div className="sticky top-[61px] z-[1] bg-background/95 px-4 py-1 text-xs font-bold text-primary backdrop-blur">{letter}</div>
                  {people.map((p) => (
                    <button key={p.id} onClick={() => setOpen(p.id)} className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors active:bg-secondary">
                      <MemberAvatar id={p.id} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{p.full_name}{p.id === me.id && <span className="ml-1 text-xs font-normal text-muted-foreground">({t("messages.you")})</span>}</span>
                        <span className="block truncate text-sm text-muted-foreground">{p.position ? `${p.position} · ` : ""}{station(p.station_id)?.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card className="divide-y divide-border/70 p-0">
          {ranking.map((p, i) => {
            const lvl = levelOf(p.points)
            return (
              <button key={p.id} onClick={() => setOpen(p.id)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 ${p.id === me.id ? "bg-primary/5" : ""}`}>
                <span className="w-7 text-center font-heading text-sm font-bold text-muted-foreground">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <MemberAvatar id={p.id} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{p.full_name}</span>
                  <span className="text-xs font-medium" style={{ color: `hsl(${lvl.current.color})` }}>{lvl.current.emoji} {t(`level.${lvl.current.key}`)}</span>
                </span>
                <span className="text-right"><span className="block font-heading text-base font-bold text-foreground">{p.points}</span><span className="text-[10px] text-muted-foreground">{t("points.points")}</span></span>
              </button>
            )
          })}
        </Card>
      )}
      <ProfileSheet memberId={open} onClose={close} />
    </div>
  )
}
