"use client"

import { useQuery } from "@tanstack/react-query"
import { Cake, CalendarCheck, Flag, GraduationCap, Link2, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Trash2, Trophy } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar } from "@/components/avatar"
import { PhoneButton } from "@/components/phone-actions"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Pill, ProgressBar } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { LEVELS, levelOf, POINT_RULES } from "@/lib/levels"
import { canModerate, isIntl, isModerator } from "@/lib/permissions"
import { ReportSheet, type ReportTarget } from "@/components/report-sheet"
import { useOnline } from "@/lib/realtime/hub"
import { useHydrated } from "@/lib/use-hydrated"
import { createClient } from "@/lib/supabase/client"

export function ageOf(birthday: string | null) {
  if (!birthday) return null
  const b = new Date(birthday)
  const n = new Date()
  return n.getFullYear() - b.getFullYear() - (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate()) ? 1 : 0)
}

/** Points, grade and rank — the grade grows with every message sent. */
export function PointsCard({ userId }: { userId: string }) {
  const { t } = useI18n()
  const member = useMemberMap()
  const m = member(userId)
  const hydrated = useHydrated()
  const { data: cachedRank } = useQuery({
    queryKey: ["rank", userId, m?.points],
    queryFn: async () => (await createClient().rpc("member_rank", { uid: userId })).data?.[0] as { rank: number; total: number } | undefined,
  })
  const rank = hydrated ? cachedRank : undefined
  const points = m?.points ?? 0
  const lvl = levelOf(points)
  return (
    <div className="rounded-2xl border border-border p-4" style={{ background: `linear-gradient(135deg, hsl(${lvl.current.color} / 0.12), transparent 70%)` }}>
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `hsl(${lvl.current.color} / 0.15)` }}>{lvl.current.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("points.grade")}</p>
          <p className="font-heading text-lg font-bold leading-tight" style={{ color: `hsl(${lvl.current.color})` }}>{t(`level.${lvl.current.key}`)}</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl font-bold leading-none text-foreground">{points.toLocaleString("tr-TR")}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{t("points.points")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <ProgressBar value={lvl.progress * 100} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{lvl.next ? t("points.toNext", { n: lvl.toNext, level: t(`level.${lvl.next.key}`) }) : t("points.max")}</span>
          {rank && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Trophy className="size-3 text-amber-500" /> {t("points.rank", { rank: rank.rank, total: rank.total })}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-between">
        {LEVELS.map((l, i) => (
          <span key={l.key} title={t(`level.${l.key}`)} className={i <= lvl.index ? "text-base" : "text-base opacity-25 grayscale"}>{l.emoji}</span>
        ))}
      </div>
      <details className="mt-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer text-center font-medium">{t("points.how")}</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {POINT_RULES.map((r) => (
            <span key={r.key} className="flex items-center justify-between"><span>{r.emoji} {t(`points.rule.${r.key}`)}</span><b className="text-foreground">+{r.points}</b></span>
          ))}
        </div>
      </details>
    </div>
  )
}

export function ProfileSheet({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const { me, station } = useApp()
  const { t, fmtDate } = useI18n()
  const router = useRouter()
  const member = useMemberMap()
  const [opening, setOpening] = useState(false)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const online = useOnline(memberId)
  const p = member(memberId)
  if (!p) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const age = ageOf(p.birthday)

  async function message() {
    setOpening(true)
    const { data, error } = await createClient().rpc("open_dm", { other: p!.id })
    setOpening(false)
    if (error) return toast(t("common.error"), { error: true })
    onClose()
    router.push(`/messages/${data}`)
  }

  async function deleteAccount() {
    if (prompt(t("admin.deleteConfirm", { name: p!.full_name })) !== "DELETE") return
    const res = await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p!.id }) })
    if (!res.ok) return toast(t("common.error"), { error: true })
    toast(t("common.deleted"))
    onClose()
  }


  const rows = [
    p.phone && { icon: Phone, label: p.phone, href: `tel:${p.phone}` },
    { icon: Mail, label: p.email, href: `mailto:${p.email}` },
    p.linkedin && { icon: Link2, label: "LinkedIn", href: p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}` },
    p.birthday && { icon: Cake, label: `${fmtDate(p.birthday, { day: "numeric", month: "long", year: "numeric" })}${age ? ` · ${t("profile.age", { n: age })}` : ""}` },
    p.hometown && { icon: MapPin, label: p.hometown },
    p.igem_trained && { icon: GraduationCap, label: `${t("profile.igemTrained")}${p.igem_date ? ` · ${fmtDate(p.igem_date)}` : ""}` },
    { icon: CalendarCheck, label: t("profile.memberSince", { date: fmtDate(p.created_at, { month: "long", year: "numeric" }) }) },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href?: string }[]

  return (
    <Sheet open onClose={onClose} title={t("profile.title")}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={p.full_name} photoUrl={p.photo_url} stationId={p.station_id} size={92} online={online} />
        <h3 className="mt-1 font-heading text-xl font-bold text-foreground">{p.full_name}</h3>
        {isModerator(p) ? <p className="flex items-center gap-1 text-sm font-semibold text-amber-600"><ShieldCheck className="size-4" /> {t("role.moderator")}</p> : p.position && <p className="text-sm font-medium text-primary">{p.position}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <StationBadge id={p.station_id} member />
          {online ? <Pill tone="green">● {t("common.online")}</Pill> : p.last_seen_at && <Pill>{t("common.lastSeen", { when: fmtDate(p.last_seen_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</Pill>}
        </div>
      </div>

      {p.id !== me.id && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button onClick={message} loading={opening} className="flex-1"><MessageCircle className="size-4" /> {t("directory.sendMessage")}</Button>
          <PhoneButton phone={p.phone} className="size-11 rounded-2xl bg-secondary" />
        </div>
      )}

      <div className="mt-4"><PointsCard userId={p.id} /></div>

      <div className="mt-4 flex flex-col divide-y divide-border rounded-2xl border border-border">
        {rows.map((r, i) => {
          const inner = (
            <span className="flex items-center gap-3 px-4 py-3 text-sm text-foreground">
              <r.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{r.label}</span>
            </span>
          )
          return r.href ? <a key={i} href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="hover:bg-secondary/50">{inner}</a> : <div key={i}>{inner}</div>
        })}
      </div>

      {p.id !== me.id && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setReport({ kind: "user", targetId: p.id, label: p.full_name })}><Flag className="size-4" /> {t("report.action")}</Button>
      )}
      {canModerate(me) && p.id !== me.id && p.app_role !== "admin" && (
        <Button variant="ghost" className="mt-1 w-full text-destructive" onClick={deleteAccount}><Trash2 className="size-4" /> {t("directory.deleteAccount")}</Button>
      )}
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Sheet>
  )
}
