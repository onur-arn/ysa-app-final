"use client"

import { useRouter } from "next/navigation"
import { openLink } from "@/lib/open-link"
import { Linkified } from "@/components/linkified"
import { ProfileLink } from "@/components/profile/profile-link"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarPlus, Clock, ExternalLink, Lock, MapPin, Pencil, Trash2 } from "lucide-react"
import { MemberAvatar } from "@/components/avatar"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { downloadIcs } from "@/lib/ics"
import { useI18n } from "@/lib/i18n/context"
import { isBoard } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { AppEvent } from "@/lib/types"

export function EventDetail({ event, onClose, onEdit }: { event: AppEvent | null; onClose: () => void; onEdit: (e: AppEvent) => void }) {
  const router = useRouter()
  const { me } = useApp()
  const { t, fmtDate } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  if (!event) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  if (event.locked) {
    return (
      <Sheet open onClose={onClose} title={t("agenda.private")}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600"><Lock className="size-8" /></span>
          <StationBadge id={event.station_id} />
          <p className="text-sm text-muted-foreground">{fmtDate(event.starts_at, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="max-w-xs text-sm text-foreground text-pretty">{t("agenda.lockedText")}</p>
        </div>
      </Sheet>
    )
  }
  const canEdit = event.created_by === me.id || isBoard(me)
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const past = (end ?? start) < new Date()

  async function remove() {
    if (!confirm(t("agenda.confirmDelete"))) return
    qc.setQueryData<AppEvent[]>(qk.events, (old) => old?.filter((e) => e.id !== event!.id))
    onClose()
    const { error } = await createClient().from("events").delete().eq("id", event!.id)
    if (error) {
      toast(t("common.error"), { error: true })
      void qc.invalidateQueries({ queryKey: qk.events })
    }
  }

  return (
    <Sheet open onClose={onClose} title={event.title}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StationBadge id={event.station_id} className="py-0.5 text-[11px]" />
          {event.is_private && <Pill tone="amber"><Lock className="size-3" /> {t("agenda.private")}</Pill>}
          <Pill tone={past ? "neutral" : "green"}>{past ? t("agenda.pastEvent") : t("agenda.upcoming")}</Pill>
        </div>
        <p className="flex items-start gap-2.5 text-foreground">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {event.all_day
              ? `${fmtDate(start, { day: "numeric", month: "long" })}${end ? ` → ${fmtDate(end, { day: "numeric", month: "long", year: "numeric" })}` : ""}`
              : `${fmtDate(start, { weekday: "long", day: "numeric", month: "long" })} · ${fmtDate(start, { hour: "2-digit", minute: "2-digit" })}${end ? ` – ${fmtDate(end, { hour: "2-digit", minute: "2-digit" })}` : ""}`}
          </span>
        </p>
        {event.location && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`} onClick={(e) => { e.preventDefault(); void openLink(`https://maps.google.com/?q=${encodeURIComponent(event.location!)}`, (p) => router.push(p)) }} className="flex items-start gap-2.5 text-foreground hover:text-primary">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {event.location}
          </a>
        )}
        {event.link && <a href={event.link} onClick={(e) => { e.preventDefault(); void openLink(event.link!, (p) => router.push(p)) }} className="flex items-start gap-2.5 break-all text-primary"><ExternalLink className="mt-0.5 size-4 shrink-0" /> {event.link}</a>}
        {event.description && <p className="whitespace-pre-wrap break-words rounded-2xl bg-secondary/60 p-3 text-foreground"><Linkified text={event.description} /></p>}
        {event.created_by && (
          <ProfileLink id={event.created_by} className="flex items-center gap-2 text-xs text-muted-foreground"><MemberAvatar id={event.created_by} size={22} showOnline={false} /> {t("agenda.createdBy", { name: member(event.created_by)?.full_name ?? "" })}</ProfileLink>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={() => downloadIcs(event)}><CalendarPlus className="size-4" /> {t("agenda.addToCalendar")}</Button>
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={() => onEdit(event)}><Pencil className="size-4" /> {t("common.edit")}</Button>
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive"><Trash2 className="size-4" /> {t("common.delete")}</Button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  )
}
