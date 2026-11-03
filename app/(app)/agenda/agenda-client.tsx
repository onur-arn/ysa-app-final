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
import { isGuest } from "@/lib/permissions"
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

const DAY = 86_400_000
const dayIndex = (d: Date) => Math.round(dayStart(d).getTime() / DAY)
/** "Bir dönem" events: drawn as one continuous bar across the days they cover */
const isSpan = (e: AppEvent) => !!e.ends_at && dayIndex(new Date(e.ends_at)) > dayIndex(new Date(e.starts_at))
const MAX_ROWS = 3 // bars + chips visible per day cell; the rest becomes "+n"

type Bar = { e: AppEvent; from: number; to: number; lane: number; head: boolean; tail: boolean }

/** Lays the multi-day events of one week out in lanes so they never overlap. */
function weekBars(events: AppEvent[], weekStart: Date): Bar[] {
  const w0 = dayIndex(weekStart)
  const lanes: number[] = [] // last column used per lane
  return events
    .map((e) => ({ e, s: dayIndex(new Date(e.starts_at)) - w0, t: dayIndex(new Date(e.ends_at!)) - w0 }))
    .filter(({ s, t }) => t >= 0 && s <= 6)
    .sort((a, b) => a.s - b.s || b.t - a.t)
    .map(({ e, s, t }) => {
      const from = Math.max(0, s), to = Math.min(6, t)
      let lane = lanes.findIndex((end) => end < from)
      if (lane === -1) lane = lanes.length
      lanes[lane] = to
      return { e, from, to, lane, head: s >= 0, tail: t <= 6 }
    })
}

export function AgendaClient() {
  const { t, fmtDate, locale } = useI18n()
  const { me, station } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const { data: events = [] } = useEvents()
  const [view, setView] = useState<"month" | "list">("month")
  const [scope, setScope] = useState<"all" | "mine">(isGuest(me) ? "all" : "mine")
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

  const spans = useMemo(() => visible.filter(isSpan), [visible])
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)), [days])
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
          {!isGuest(me) && <button onClick={() => setScope("mine")} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", scope === "mine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{station(me.station_id)?.short}</button>}
          <button onClick={() => setScope("all")} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", scope === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{t("common.all")}</button>
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
              className="grid min-h-0 flex-1 grid-rows-6"
            >
              {weeks.map((week) => {
                const bars = weekBars(spans, week[0])
                // Every cell in the week reserves the same number of bar lanes, so the
                // single-day chips below the bars line up neatly from column to column.
                const shownBars = bars.filter((x) => x.lane < MAX_ROWS)
                const weekLanes = shownBars.length ? Math.max(...shownBars.map((x) => x.lane)) + 1 : 0
                const room = Math.max(0, MAX_ROWS - weekLanes)
                return (
                  <div key={week[0].toISOString()} className="relative grid min-h-0 grid-cols-7 border-b border-border/50 last:border-b-0">
                    {week.map((d, col) => {
                      const inMonth = d.getMonth() === month.getMonth()
                      const today = isSameDay(d, new Date())
                      const here = bars.filter((x) => x.from <= col && x.to >= col)
                      const singles = onDay(d).filter((e) => !isSpan(e))
                      const hidden = here.filter((x) => x.lane >= MAX_ROWS).length + Math.max(0, singles.length - room)
                      return (
                        <button
                          key={d.toISOString()}
                          onClick={() => setDay(d)}
                          className={cn("flex min-h-0 flex-col gap-0.5 overflow-hidden border-r border-border/50 p-0.5 text-left transition-colors hover:bg-secondary/50 last:border-r-0", !inMonth && "bg-muted/40")}
                        >
                          <span className={cn("mx-auto flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold md:mx-0", today ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50")}>
                            {d.getDate()}
                          </span>
                          {/* reserve the lanes the bar overlay draws, same height for every day of the week */}
                          {Array.from({ length: weekLanes }, (_, i) => <span key={i} className="h-3.5 shrink-0 md:h-4" />)}
                          {singles.slice(0, room).map((e) => {
                            const color = station(e.station_id)?.color ?? "188 57% 48%"
                            return (
                              <span
                                key={e.id}
                                onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id) }}
                                className="flex h-3.5 shrink-0 items-center gap-0.5 truncate rounded px-1 text-[9px] font-semibold leading-none md:h-4 md:text-[11px]"
                                style={{ backgroundColor: `hsl(${color} / 0.16)`, color: `hsl(${color})` }}
                              >
                                {e.is_private && <Lock className="size-2.5 shrink-0" />}
                                {!e.locked && <span className="truncate">{e.title}</span>}
                              </span>
                            )
                          })}
                          {hidden > 0 && <span className="px-1 text-[9px] font-bold leading-none text-muted-foreground">+{hidden}</span>}
                        </button>
                      )
                    })}
                    {/* dönem bars: one continuous line per event across the week */}
                    <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 [grid-auto-rows:0.875rem] md:[grid-auto-rows:1rem]">
                      {bars.filter((x) => x.lane < MAX_ROWS).map((x) => {
                        const color = station(x.e.station_id)?.color ?? "188 57% 48%"
                        return (
                          <span
                            key={x.e.id}
                            onClick={() => setOpenId(x.e.id)}
                            className={cn("pointer-events-auto flex cursor-pointer items-center gap-0.5 overflow-hidden px-1 text-[9px] font-semibold leading-none text-white md:text-[11px]",
                              x.head ? "ml-0.5 rounded-l-full" : "", x.tail ? "mr-0.5 rounded-r-full" : "")}
                            style={{ gridColumn: `${x.from + 1} / ${x.to + 2}`, gridRow: x.lane + 1, backgroundColor: `hsl(${color})` }}
                          >
                            {x.e.is_private && <Lock className="size-2.5 shrink-0" />}
                            {!x.e.locked && <span className="truncate">{x.head || x.from === 0 ? x.e.title : ""}</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
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
            {!isGuest(me) && <button onClick={() => { const d = day; setDay(null); setForm({ open: true, date: d }) }} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="size-4" /> {t("agenda.newEvent")}
            </button>}
          </div>
        )}
      </Sheet>

      {!isGuest(me) && <Fab icon={Plus} label={t("agenda.newEvent")} onClick={() => setForm({ open: true, date: new Date() })} />}
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
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">{e.is_private && <Lock className="size-3.5 shrink-0 text-amber-500" />}{e.locked ? t("agenda.private") : e.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {e.all_day ? `${fmtDate(d, { day: "numeric", month: "short" })} → ${e.ends_at ? fmtDate(e.ends_at, { day: "numeric", month: "short" }) : ""}` : fmtDate(d, { hour: "2-digit", minute: "2-digit" })}
            {e.location && <><MapPin className="ml-1 size-3 shrink-0" /> {e.location}</>}
            {e.locked && <span className="ml-1">· {t("agenda.lockedHint")}</span>}
          </p>
          <StationBadge id={e.station_id} short className="mt-1 px-2 py-0 text-[10px]" />
        </div>
        {e.is_private && <span className="sr-only">{t("agenda.private")}</span>}
      </Card>
    </button>
  )
}
