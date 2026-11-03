"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Check, Eye, Flag, ScrollText, ShieldCheck, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { MemberAvatar } from "@/components/avatar"
import { Card, EmptyState, Pill, Segmented } from "@/components/ui/misc"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useModLog, useReports } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import type { Report } from "@/lib/types"

export function ModerationClient() {
  const { t } = useI18n()
  const [tab, setTab] = useState<"reports" | "log">("reports")
  const { data: reports = [] } = useReports(true)
  const open = reports.filter((r) => r.status === "open")
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-amber-600" />
        <p className="text-muted-foreground">{t("mod.banner")}</p>
      </div>
      <Segmented value={tab} onChange={setTab} layoutId="mod-tab" options={[
        { id: "reports", label: <span className="flex items-center gap-1.5"><Flag className="size-4" />{t("mod.tab.reports")}</span>, count: open.length },
        { id: "log", label: <span className="flex items-center gap-1.5"><ScrollText className="size-4" />{t("mod.tab.log")}</span> },
      ]} />
      {tab === "reports" ? <Reports reports={reports} /> : <Log />}
    </div>
  )
}

function Reports({ reports }: { reports: Report[] }) {
  const { t, fmtDate } = useI18n()
  const qc = useQueryClient()
  const router = useRouter()
  const member = useMemberMap()
  const open = reports.filter((r) => r.status === "open")

  async function resolve(r: Report, status: "resolved" | "dismissed") {
    const { error } = await createClient().rpc("resolve_report", { rid: r.id, p_status: status })
    if (error) return toast(error.message, { error: true })
    toast(t(`mod.status.${status}`))
    void qc.invalidateQueries({ queryKey: qk.reports })
    void qc.invalidateQueries({ queryKey: qk.modLog })
  }

  function openTarget(r: Report) {
    if (r.kind === "message" && r.conversation_id) router.push(`/messages/${r.conversation_id}?mod=1`)
    else if (r.kind === "post" || r.kind === "comment") router.push(`/feed?post=${r.target_id}`)
    else if (r.kind === "event") router.push(`/agenda?event=${r.target_id}`)
    else if (r.kind === "task") router.push(`/gorevler?open=${r.target_id}`)
    else if (r.kind === "user") router.push(`/annuaire?member=${r.target_id}`)
  }

  if (open.length === 0) return <EmptyState icon={Flag} title={t("mod.noReports")} />
  return (
    <div className="flex flex-col gap-2">
      {open.map((r) => (
        <Card key={r.id} className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <Pill tone="amber">{t(`mod.kind.${r.kind}`)}</Pill>
            <span className="ml-auto text-xs text-muted-foreground">{fmtDate(r.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {r.reason && <p className="whitespace-pre-wrap break-words text-sm text-foreground">{r.reason}</p>}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {r.reporter_id && <MemberAvatar id={r.reporter_id} size={18} showOnline={false} />}
            <span>{t("mod.reportedBy")}: {member(r.reporter_id ?? "")?.full_name ?? "—"}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button onClick={() => openTarget(r)} className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70">
              <Eye className="size-3.5" /> {r.kind === "message" ? t("mod.openConversation") : t("common.view")}
            </button>
            <button onClick={() => resolve(r, "resolved")} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/25">
              <Check className="size-3.5" /> {t("mod.resolve")}
            </button>
            <button onClick={() => resolve(r, "dismissed")} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">
              <X className="size-3.5" /> {t("mod.dismiss")}
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function Log() {
  const { t, fmtDate } = useI18n()
  const member = useMemberMap()
  const { data: log = [] } = useModLog(true)
  if (log.length === 0) return <EmptyState icon={ScrollText} title={t("mod.noLog")} />
  return (
    <div className="flex flex-col gap-1.5">
      {log.map((e) => (
        <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs">
          <ShieldCheck className="size-3.5 shrink-0 text-amber-600" />
          <span className="font-semibold text-foreground">{member(e.moderator_id ?? "")?.full_name ?? "—"}</span>
          <span className="text-muted-foreground">{e.action}</span>
          <span className="ml-auto shrink-0 text-muted-foreground">{fmtDate(e.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      ))}
    </div>
  )
}
