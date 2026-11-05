"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Lock, LockOpen } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/misc"
import { Field, Input, Select, Sheet, Textarea } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isIntl } from "@/lib/permissions"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { AppEvent } from "@/lib/types"
import { cn, toDateInput } from "@/lib/utils"

const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5)

export function EventForm({ open, event, defaultDate, onClose }: { open: boolean; event?: AppEvent; defaultDate?: Date; onClose: () => void }) {
  const { me, stations, station } = useApp()
  const { t } = useI18n()
  const qc = useQueryClient()
  const intl = isIntl(me)
  const [type, setType] = useState<"once" | "period">("once")
  const [f, setF] = useState({ title: "", day: "", time: "19:00", endTime: "", endDay: "", location: "", link: "", description: "", station_id: "", is_private: false })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (event) {
      setType(event.all_day ? "period" : "once")
      setF({
        title: event.title, day: toDateInput(event.starts_at), time: event.all_day ? "19:00" : hhmm(event.starts_at),
        endTime: !event.all_day && event.ends_at ? hhmm(event.ends_at) : "", endDay: event.all_day && event.ends_at ? toDateInput(event.ends_at) : "",
        location: event.location ?? "", link: event.link ?? "", description: event.description ?? "", station_id: event.station_id ?? "", is_private: event.is_private,
      })
    } else {
      setType("once")
      setF({ title: "", day: toDateInput(defaultDate ?? new Date()), time: "19:00", endTime: "", endDay: "", location: "", link: "", description: "", station_id: me.station_id ?? "", is_private: false })
    }
  }, [open, event, defaultDate, me.station_id])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  async function submit() {
    if (!f.title.trim() || !f.day || (type === "period" && !f.endDay)) return toast(t("common.requiredFields"), { error: true })
    const starts_at = new Date(`${f.day}T${type === "once" ? f.time : "00:00"}`)
    const ends_at = type === "period" ? new Date(`${f.endDay}T23:59`) : f.endTime ? new Date(`${f.day}T${f.endTime}`) : null
    if (ends_at && ends_at < starts_at) return toast(t("agenda.err.endBeforeStart"), { error: true })
    setLoading(true)
    const row = {
      title: f.title.trim(), starts_at: starts_at.toISOString(), ends_at: ends_at?.toISOString() ?? null, all_day: type === "period",
      location: f.location.trim() || null, link: f.link.trim() || null, description: f.description.trim() || null,
      station_id: intl ? f.station_id || null : me.station_id, is_private: f.is_private,
    }
    const supabase = createClient()
    const { error } = event ? await supabase.from("events").update(row).eq("id", event.id) : await supabase.from("events").insert({ ...row, created_by: me.id })
    setLoading(false)
    if (error) return toast(t("common.error"), { error: true })
    void qc.invalidateQueries({ queryKey: qk.events })
    if (!event) dispatchPush()
    toast(event ? t("common.saved") : t("agenda.created"))
    onClose()
  }

  const own = station(me.station_id)
  return (
    <Sheet open={open} onClose={onClose} title={event ? t("agenda.editEvent") : t("agenda.newEvent")} footer={<Button className="w-full" size="lg" onClick={submit} loading={loading}>{event ? t("common.save") : t("agenda.create")}</Button>}>
      <div className="flex flex-col gap-4">
        <Segmented value={type} onChange={setType} layoutId="ev-type" options={[{ id: "once", label: t("agenda.once") }, { id: "period", label: t("agenda.period") }]} />
        <Field label={t("agenda.eventTitle")}><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={t("agenda.titlePlaceholder")} /></Field>
        {type === "once" ? (
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("agenda.day")}><Input type="date" value={f.day} onChange={(e) => set("day", e.target.value)} className="px-2 text-sm" /></Field>
            <Field label={t("agenda.time")}><Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className="px-2 text-sm" /></Field>
            <Field label={t("agenda.endTime")}><Input type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} className="px-2 text-sm" /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("agenda.start")}><Input type="date" value={f.day} onChange={(e) => set("day", e.target.value)} className="px-3" /></Field>
            <Field label={t("agenda.end")}><Input type="date" value={f.endDay} onChange={(e) => set("endDay", e.target.value)} className="px-3" /></Field>
          </div>
        )}
        <Field label={t("agenda.place")}><Input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder={t("agenda.placePlaceholder")} /></Field>
        <Field label={t("agenda.link")}><Input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://zoom.us/..." /></Field>
        <Field label={t("common.description")}><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder={t("agenda.descPlaceholder")} /></Field>
        <Field label={t("profile.station")}>
          {intl ? (
            <Select value={f.station_id} onChange={(e) => set("station_id", e.target.value)}>
              <option value="">{t("common.allStations")}</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          ) : (
            <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-muted px-4 text-sm">
              <span className="flex size-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: `hsl(${own?.color})` }}>{own?.short}</span>
              <span className="font-medium text-foreground">{own?.city}</span>
            </div>
          )}
        </Field>
        <button type="button" onClick={() => set("is_private", !f.is_private)} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors", f.is_private ? "border-amber-500/50 bg-amber-500/10" : "border-border")}>
          <span className={cn("flex size-10 items-center justify-center rounded-xl", f.is_private ? "bg-amber-500 text-white" : "bg-secondary text-muted-foreground")}>
            {f.is_private ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">{f.is_private ? t("agenda.private") : t("agenda.public")}</span>
            <span className="block text-xs text-muted-foreground">{f.is_private ? t("agenda.privateHint") : t("agenda.publicHint")}</span>
          </span>
        </button>
      </div>
    </Sheet>
  )
}
