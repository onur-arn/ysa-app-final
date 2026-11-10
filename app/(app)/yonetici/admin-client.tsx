"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Check, Eye, Flag, MapPin, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Card, Chips, EmptyState, Pill, Segmented } from "@/components/ui/misc"
import { Field, Input, Select, Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useReports } from "@/lib/data/hooks"
import { isIntlOnlyPosition, positionsFor } from "@/lib/constants"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Report, Station } from "@/lib/types"

const ALL_KEY = ["admin-profiles"] as const

export function AdminClient() {
  const { t } = useI18n()
  const { data: profiles = [] } = useQuery({
    queryKey: ALL_KEY,
    queryFn: async () => ((await createClient().from("profiles").select("*").order("created_at", { ascending: false })).data ?? []) as Profile[],
  })
  const pending = profiles.filter((p) => p.status === "pending")
  const [tab, setTab] = useState<"pending" | "members" | "stations" | "reports">(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "reports" ? "reports" : "pending")
  const { data: reports = [] } = useReports(true)
  const openReports = reports.filter((r) => r.status === "open")
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <Segmented value={tab} onChange={setTab} layoutId="admin-tab" options={[
        { id: "pending", label: <span className="flex items-center gap-1.5"><UserCheck className="size-4" />{t("admin.pending")}</span>, count: pending.length },
        { id: "members", label: <span className="flex items-center gap-1.5"><Users className="size-4" />{t("admin.members")}</span> },
        { id: "stations", label: <span className="flex items-center gap-1.5"><Building2 className="size-4" />{t("admin.stations")}</span> },
        { id: "reports", label: <span className="flex items-center gap-1.5"><Flag className="size-4" />{t("mod.tab.reports")}</span>, count: openReports.length },
      ]} />
      {tab === "pending" ? <Pending pending={pending} />
        : tab === "members" ? <Members profiles={profiles.filter((p) => p.status !== "pending")} />
        : tab === "stations" ? <Stations />
        : <Reports reports={reports} />}
    </div>
  )
}

function Pending({ pending }: { pending: Profile[] }) {
  const { t, fmtDate, fmtRelative } = useI18n()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function decide(p: Profile, decision: "approve" | "reject") {
    if (decision === "reject" && !confirm(t("admin.confirmReject", { name: p.full_name }))) return
    setBusy(p.id)
    const res = await fetch("/api/admin/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.id, decision }) })
    setBusy(null)
    if (!res.ok) return toast(t("common.error"), { error: true })
    toast(decision === "approve" ? t("admin.approved", { name: p.first_name }) : t("admin.rejected"))
    if (decision === "approve") dispatchPush()
    void qc.invalidateQueries({ queryKey: ALL_KEY })
    void qc.invalidateQueries({ queryKey: qk.members })
    void qc.invalidateQueries({ queryKey: qk.feed })
  }

  if (!pending.length) return <EmptyState icon={UserCheck} title={t("admin.noPending")} />
  return (
    <div className="flex flex-col gap-3">
      {pending.map((p) => (
        <Card key={p.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={p.full_name} photoUrl={p.photo_url} stationId={p.station_id} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{p.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email} · {fmtRelative(p.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StationBadge id={p.station_id} member className="py-0.5 text-[11px]" />
            {p.position && <Pill tone="violet">{p.position}</Pill>}
            {p.igem_trained && <Pill tone="green">iGEM ✓</Pill>}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            {p.phone && <span>📞 {p.phone}</span>}
            {p.birthday && <span>🎂 {fmtDate(p.birthday)}</span>}
            {p.hometown && <span>📍 {p.hometown}</span>}
            {p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-primary">LinkedIn</a>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decide(p, "reject")} disabled={busy === p.id} className="text-destructive"><X className="size-4" /> {t("admin.reject")}</Button>
            <Button onClick={() => decide(p, "approve")} loading={busy === p.id}><Check className="size-4" /> {t("admin.approve")}</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function Members({ profiles }: { profiles: Profile[] }) {
  const { t } = useI18n()
  const { station } = useApp()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("active")
  const [edit, setEdit] = useState<Profile | null>(null)
  const list = useMemo(() => profiles.filter((p) => (status === "all" || p.status === status) && `${p.full_name} ${p.email}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))), [profiles, q, status])
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.searchMember")} className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <Chips value={status} onChange={setStatus} options={["active", "suspended", "rejected", "all"].map((s) => ({ id: s, label: t(s === "all" ? "common.all" : `admin.status.${s}`) }))} />
      <Card className="divide-y divide-border/70 p-0">
        {list.map((p) => (
          <button key={p.id} onClick={() => setEdit(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40">
            <Avatar name={p.full_name} photoUrl={p.photo_url} stationId={p.station_id} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{p.full_name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{p.position ?? t("profile.member")} · {station(p.station_id)?.city ?? "Misafir"}</span>
            </span>
            {p.app_role === "admin" && <Pill tone="violet"><ShieldCheck className="size-3" /> Admin</Pill>}
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        ))}
      </Card>
      <MemberEditor profile={edit} onClose={() => setEdit(null)} />
    </>
  )
}

function MemberEditor({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const { t } = useI18n()
  const { me, stations } = useApp()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(false)
  if (!profile) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const v = { ...profile, ...draft }
  const self = profile.id === me.id

  function close() {
    setDraft({})
    onClose()
  }

  async function save() {
    setLoading(true)
    const guest = !v.station_id
    const { error } = await createClient().from("profiles")
      .update({ status: v.status, station_id: guest ? null : v.station_id, position: guest ? "Misafir" : v.position === "Misafir" ? null : v.position || null })
      .eq("id", profile!.id)
    setLoading(false)
    if (error) return toast(error.message.includes("unique") ? t("directory.positionTaken") : t("common.error"), { error: true })
    toast(t("common.saved"))
    void qc.invalidateQueries({ queryKey: ALL_KEY })
    void qc.invalidateQueries({ queryKey: qk.members })
    close()
  }

  async function hardDelete() {
    if (prompt(t("admin.deleteConfirm", { name: profile!.full_name })) !== "DELETE") return
    const res = await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: profile!.id }) })
    if (!res.ok) return toast(t("common.error"), { error: true })
    void qc.invalidateQueries({ queryKey: ALL_KEY })
    void qc.invalidateQueries({ queryKey: qk.members })
    close()
  }

  return (
    <Sheet open onClose={close} title={profile.full_name} footer={<Button className="w-full" size="lg" onClick={save} loading={loading}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{profile.email} · {profile.points} {t("points.points")}</p>
        <div className="grid grid-cols-1 gap-3">
          <Field label={t("admin.statusLabel")}>
            <Select value={v.status} disabled={self} onChange={(e) => setDraft({ ...draft, status: e.target.value as Profile["status"] })}>
              {["active", "suspended", "rejected"].map((s) => <option key={s} value={s}>{t(`admin.status.${s}`)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("profile.station")}>
          <Select value={v.station_id ?? ""} onChange={(e) => setDraft({ ...draft, station_id: e.target.value || null, ...((!e.target.value || v.position === "Misafir" || (e.target.value !== "intl" && isIntlOnlyPosition(v.position))) ? { position: "" } : {}) })}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="">{t("admin.guest")}</option>
          </Select>
        </Field>
        {v.station_id && (
          <Field label={t("profile.position")}>
            <Select value={v.position === "Misafir" ? "" : v.position ?? ""} onChange={(e) => setDraft({ ...draft, position: e.target.value })}>
              <option value="">{t("profile.memberOnly")}</option>
              {positionsFor(v.station_id).map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
        )}
        <p className="rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">{t("admin.rolesHelp")}</p>
        {!self && <Button variant="ghost" onClick={hardDelete} className="text-destructive"><Trash2 className="size-4" /> {t("admin.deleteAccount")}</Button>}
      </div>
    </Sheet>
  )
}

/** "#RRGGBB" ⇄ the "H S% L%" strings stations store */
function hexToHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return `${Math.round((h * 60 + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
function hslToHex(hsl: string) {
  const [h, s, l] = hsl.replace(/%/g, "").split(/\s+/).map(Number)
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
const slug = (city: string) => city.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function Stations() {
  const { t } = useI18n()
  const { stations } = useApp()
  const [edit, setEdit] = useState<Station | "new" | null>(null)
  return (
    <>
      <p className="text-sm text-muted-foreground">{t("admin.station.help")}</p>
      <Button onClick={() => setEdit("new")}><Plus className="size-4" /> {t("admin.station.new")}</Button>
      <Card className="divide-y divide-border/70 p-0">
        {stations.map((s) => (
          <button key={s.id} onClick={() => setEdit(s)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40">
            <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${s.color})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{s.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{s.short} · {s.city}</span>
            </span>
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        ))}
      </Card>
      {edit && <StationEditor station={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function StationEditor({ station, onClose }: { station: Station | null; onClose: () => void }) {
  const { t } = useI18n()
  const { stations } = useApp()
  const router = useRouter()
  const [city, setCity] = useState(station?.city ?? "")
  const [name, setName] = useState(station?.name ?? "")
  const [short, setShort] = useState(station?.short ?? "")
  const [color, setColor] = useState(station ? hslToHex(station.color) : "#e11d74")
  const [place, setPlace] = useState<{ lat: number; lng: number; label: string } | null>(
    station?.lat != null && station.lng != null ? { lat: station.lat, lng: station.lng, label: station.city } : null)
  const [busy, setBusy] = useState<"locate" | "save" | "delete" | null>(null)

  function changeCity(v: string) {
    setCity(v)
    if (!station) {
      setName(v.trim() ? `${v.trim()} İstasyonu` : "")
      setShort(v.trim().slice(0, 3).toLocaleUpperCase("tr"))
    }
    setPlace(null)
  }

  // Open-Meteo geocoding: free, no key; only the city name is sent.
  async function geocode() {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=tr&name=${encodeURIComponent(city.trim())}`).catch(() => null)
    const hit = res?.ok ? ((await res.json().catch(() => ({}))) as { results?: { latitude: number; longitude: number; name: string; country?: string }[] }).results?.[0] : undefined
    return hit ? { lat: hit.latitude, lng: hit.longitude, label: [hit.name, hit.country].filter(Boolean).join(", ") } : null
  }

  async function locate() {
    if (!city.trim()) return
    setBusy("locate")
    const found = await geocode()
    setBusy(null)
    if (!found) return toast(t("admin.station.notFound"), { error: true })
    setPlace(found)
  }

  async function save() {
    if (!city.trim() || !name.trim() || !short.trim()) return
    setBusy("save")
    // Not placed by hand yet: place it now, so the station shows on the sign-up map right away.
    const at = place ?? (station?.id === "intl" ? null : await geocode())
    const row = { city: city.trim(), name: name.trim(), short: short.trim().toLocaleUpperCase("tr").slice(0, 4), color: hexToHsl(color), lat: at?.lat ?? null, lng: at?.lng ?? null }
    const sb = createClient()
    const id = station?.id ?? slug(city)
    if (!station && (!id || stations.some((s) => s.id === id))) { setBusy(null); return toast(t("admin.station.exists"), { error: true }) }
    const { error } = station
      ? await sb.from("stations").update(row).eq("id", station.id)
      : await sb.from("stations").insert({ id, ...row, position: Math.max(0, ...stations.map((s) => s.position)) + 1 })
    setBusy(null)
    if (error) return toast(error.message.includes("duplicate") ? t("admin.station.exists") : t("common.error"), { error: true })
    toast(station ? t("common.saved") : t("admin.station.created", { name: row.name }))
    if (station?.id !== "intl" && !at) toast(t("admin.station.notFound"), { error: true })
    router.refresh()   // the layout reloads the stations: badges, filters and forms pick it up
    onClose()
  }

  // Members become Misafir; the station's tasks and agenda events are deleted (supabase delete_station).
  async function remove() {
    if (!station || station.id === "intl") return
    if (prompt(t("admin.station.deleteConfirm", { name: station.name })) !== "DELETE") return
    setBusy("delete")
    const { error } = await createClient().rpc("delete_station", { p_id: station.id })
    setBusy(null)
    if (error) return toast(t("common.error"), { error: true })
    toast(t("admin.station.deleted", { name: station.name }))
    router.refresh()
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={station ? t("admin.station.edit") : t("admin.station.new")}
      footer={<Button className="w-full" size="lg" onClick={save} loading={busy === "save"} disabled={!city.trim() || !name.trim() || !short.trim()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <Field label={t("admin.station.city")}>
          <Input value={city} onChange={(e) => changeCity(e.target.value)} placeholder="Milano" />
        </Field>
        {station?.id !== "intl" && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={locate} loading={busy === "locate"} disabled={!city.trim()}><MapPin className="size-4" /> {t("admin.station.locate")}</Button>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{place ? t("admin.station.located", { place: place.label }) : t("admin.station.notLocated")}</span>
          </div>
        )}
        <Field label={t("admin.station.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("admin.station.short")}>
            <Input value={short} maxLength={4} onChange={(e) => setShort(e.target.value)} />
          </Field>
          <Field label={t("admin.station.color")}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-background p-1" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {stations.filter((s) => s.id !== station?.id).map((s) => (
            <span key={s.id} className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="size-3 rounded-full" style={{ backgroundColor: `hsl(${s.color})` }} />{s.short}</span>
          ))}
        </div>
        {station && station.id !== "intl" && (
          <Button variant="ghost" className="text-destructive" onClick={remove} loading={busy === "delete"}><Trash2 className="size-4" /> {t("admin.station.delete")}</Button>
        )}
      </div>
    </Sheet>
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
