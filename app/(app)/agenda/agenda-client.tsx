"use client"

import { AnimatePresence, motion } from "framer-motion"
import { CalendarDays, ChevronLeft, ChevronRight, List, Lock, MapPin, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { StationBadge } from "@/components/station-badge"
import { Card, EmptyState, Fab } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { useApp } from "@/components/providers/app-context"
import { useEvents } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import type { AppEvent } from "@/lib/types"
import { cn, isSameDay } from "@/lib/utils"
import { EventDetail } from "./event-detail"
import { EventForm } from "./event-form"

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function occursOn(e: AppEvent, d: Date) {
  const s = dayStart(new Date(e.starts_at))
  const end = e.ends_at ? dayStart(new Date(e.ends_at)) : s
  return d >= s && d <= end
}

export function AgendaClient() {
  const { t, fmtDate, locale } = useI18n()
  const { me, station } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const { data: events = [] } = useEvents()
  const [view, setView] = useState<"month" | "list">("month")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [dir, setDir] = useState(0)
  const [day, setDay] = useState<Date | null>(null)
  const [openId, setOpenId] = useState<string | null>(params.get("event"))
  const [form, setForm] = useState<{ open: boolean; event?: AppEvent; date?: Date }>({ open: false })

  useEffect(() => setOpenId(params.get("event")), [params])

  const visible = useMemo(
    () => events.filter((e) => scope === "all" || !e.station_id || e.station_id === me.station_id),
    [events, scope, me.station_id],
  )

  const days = useMemo(() => {
    const offset = (month.getDay() + 6) % 7 // weeks start on Monday
    return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i))
  }, [month])

  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))),
    [locale],
  )

  const go = (delta: number) => {
    setDir(delta)
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  }

  const onDay = (d: Date) => visible.filter((e) => occursOn(e, d)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const upcoming = visible.filter((e) => new Date(e.ends_at ?? e.starts_at) >= dayStart(new Date()))
  const open = events.find((e) => e.id === openId) ?? null
  const monthCount = visible.filter((e) => new Date(e.starts_at).getMonth() === month.getMonth() && new Date(e.starts_at).getFullYear() === month.getFullYear()).length

  function closeEvent() {
    setOpenId(null)
    if (params.get("event")) router.replace("/agenda")
  }

  return (
    <div className="flex h-[calc(100dvh-61px-7rem)] flex-col px-2 pt-2 md:h-[calc(100dvh-61px-2.5rem)] md:px-4">
      {/* toolbar */}
      <div className="flex items-center gap-1 px-1 pb-2">
        <button onClick={() => go(-1)} className="flex size-9 items-center justify-center rounded-xl hover:bg-secondary" aria-label="prev"><ChevronLeft className="size-5" /></button>
        <button
          onClick={() => { setDir(0); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate font-heading text-lg font-bold capitalize leading-tight text-foreground">{fmtDate(month, { month: "long", year: "numeric" })}</span>
          <span className="block text-[11px] text-muted-foreground">{t("agenda.eventsThisMonth")}: {monthCount}</span>
        </button>
        <button onClick={() => go(1)} className="flex size-9 items-center justify-center rounded-xl hover:bg-secondary" aria-label="next"><ChevronRight className="size-5" /></button>
        <div className="ml-1 flex rounded-xl bg-secondary p-0.5">
          <button onClick={() => setScope("all")} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", scope === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{t("common.all")}</button>
          <button onClick={() => setScope("mine")} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", scope === "mine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{station(me.station_id)?.short}</button>
        </div>
        <button onClick={() => setView(view === "month" ? "list" : "month")} className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary" aria-label="view">
          {view === "month" ? <List className="size-5" /> : <CalendarDays className="size-5" />}
        </button>
      </div>

      {view === "month" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="grid grid-cols-7 border-b border-border/70">
            {weekdays.map((w, i) => <span key={i} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{w}</span>)}
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={month.toISOString()}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.18 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => Math.abs(info.offset.x) > 70 && go(info.offset.x < 0 ? 1 : -1)}
              className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6"
            >
              {days.map((d) => {
                const evs = onDay(d)
                const inMonth = d.getMonth() === month.getMonth()
                const today = isSameDay(d, new Date())
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setDay(d)}
                    className={cn("flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-border/50 p-0.5 text-left transition-colors hover:bg-secondary/50 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/40")}
                  >
                    <span className={cn("mx-auto flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold md:mx-0", today ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50")}>
                      {d.getDate()}
                    </span>
                    {evs.slice(0, 3).map((e) => {
                      const color = station(e.station_id)?.color ?? "188 57% 48%"
                      return (
                        <span
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id) }}
                          className="flex items-center gap-0.5 truncate rounded px-1 py-px text-[9px] font-semibold leading-tight md:text-[11px]"
                          style={{ backgroundColor: `hsl(${color} / 0.16)`, color: `hsl(${color})` }}
                        >
                          {e.is_private && <Lock className="size-2.5 shrink-0" />}
                          <span className="truncate">{e.title}</span>
                        </span>
                      )
                    })}
                    {evs.length > 3 && <span className="px-1 text-[9px] font-bold text-muted-foreground">+{evs.length - 3}</span>}
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-1 pb-4">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title={t("agenda.noEvents")} />
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((e, i) => {
                const d = new Date(e.starts_at)
                const prev = upcoming[i - 1]
                return (
                  <div key={e.id}>
                    {(!prev || new Date(prev.starts_at).getMonth() !== d.getMonth()) && (
                      <h3 className="mb-2 mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{fmtDate(d, { month: "long", year: "numeric" })}</h3>
                    )}
                    <EventRow e={e} onClick={() => setOpenId(e.id)} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? fmtDate(day, { weekday: "long", day: "numeric", month: "long" }) : ""}>
        {day && (
          <div className="flex flex-col gap-2">
            {onDay(day).map((e) => <EventRow key={e.id} e={e} onClick={() => { setDay(null); setOpenId(e.id) }} />)}
            {onDay(day).length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("agenda.noEventsDay")}</p>}
            <button onClick={() => { const d = day; setDay(null); setForm({ open: true, date: d }) }} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="size-4" /> {t("agenda.newEvent")}
            </button>
          </div>
        )}
      </Sheet>

      <Fab icon={Plus} label={t("agenda.newEvent")} onClick={() => setForm({ open: true, date: new Date() })} />
      <EventDetail event={open} onClose={closeEvent} onEdit={(e) => { closeEvent(); setForm({ open: true, event: e }) }} />
      <EventForm open={form.open} event={form.event} defaultDate={form.date} onClose={() => setForm({ open: false })} />
    </div>
  )
}

function EventRow({ e, onClick }: { e: AppEvent; onClick: () => void }) {
  const { fmtDate, t } = useI18n()
  const { station } = useApp()
  const d = new Date(e.starts_at)
  const color = station(e.station_id)?.color ?? "188 57% 48%"
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="flex items-center gap-3 p-3 transition-colors hover:border-primary/40">
        <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: `hsl(${color} / 0.14)`, color: `hsl(${color})` }}>
          <span className="text-[10px] font-bold uppercase leading-none">{fmtDate(d, { weekday: "short" })}</span>
          <span className="font-heading text-lg font-bold leading-tight">{d.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">{e.is_private && <Lock className="size-3.5 shrink-0 text-amber-500" />}{e.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {e.all_day ? `${fmtDate(d, { day: "numeric", month: "short" })} → ${e.ends_at ? fmtDate(e.ends_at, { day: "numeric", month: "short" }) : ""}` : fmtDate(d, { hour: "2-digit", minute: "2-digit" })}
            {e.location && <><MapPin className="ml-1 size-3 shrink-0" /> {e.location}</>}
          </p>
          <StationBadge id={e.station_id} short className="mt-1 px-2 py-0 text-[10px]" />
        </div>
        {e.is_private && <span className="sr-only">{t("agenda.private")}</span>}
      </Card>
    </button>
  )
}
