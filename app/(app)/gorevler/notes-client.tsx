"use client"

import { useQueryClient } from "@tanstack/react-query"
import { NotebookPen, Pin, PinOff, Plus, Share2, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Chips, EmptyState, Fab } from "@/components/ui/misc"
import { Field, Input, Sheet, Textarea } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useNotes } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isBoard, isGuest, isIntl } from "@/lib/permissions"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLORS = [null, "48 96% 89%", "142 60% 88%", "199 89% 88%", "330 80% 92%", "262 80% 92%"]

/**
 * Notes partagées : chaque note appartient à une station et peut être partagée avec
 * d'autres stations. Tous les membres qui la voient peuvent la modifier.
 */
export function NotesClient() {
  const { t, fmtRelative } = useI18n()
  const { me, stations } = useApp()
  const member = useMemberMap()
  const router = useRouter()
  const params = useSearchParams()
  const { data: notes = [], isPending } = useNotes()
  const [scope, setScope] = useState("all")
  const [edit, setEdit] = useState<Note | "new" | null>(null)

  // ?note=<id> (from a notification) opens that note
  const wanted = params.get("note")
  useEffect(() => {
    if (!wanted) return
    const n = notes.find((x) => x.id === wanted)
    if (n) { setEdit(n); router.replace("/gorevler?tab=notes", { scroll: false }) }
  }, [wanted, notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(
    () => notes.filter((n) => scope === "all" || (scope === "shared" ? n.station_id !== me.station_id : n.station_id === scope)),
    [notes, scope, me.station_id],
  )

  if (isGuest(me)) return <EmptyState icon={NotebookPen} title={t("notes.guest")} />

  const scopes = [
    { id: "all", label: t("common.all") },
    ...(isIntl(me) ? stations.map((s) => ({ id: s.id, label: s.city, color: s.color })) : [{ id: "shared", label: t("notes.sharedWithUs") }]),
  ]

  return (
    <div className="flex flex-col gap-3">
      <Chips value={scope} onChange={setScope} options={scopes} />
      {isPending && !notes.length ? (
        <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={NotebookPen} title={t("notes.empty")} text={t("notes.emptyText")} />
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {list.map((n) => (
            <button
              key={n.id}
              onClick={() => setEdit(n)}
              className="flex min-h-28 flex-col gap-1.5 rounded-2xl border border-border p-3 text-left shadow-sm active:scale-[0.98]"
              style={n.color ? { backgroundColor: `hsl(${n.color})`, borderColor: "transparent", color: "hsl(222 47% 11%)" } : undefined}
            >
              <span className="flex items-start gap-1">
                <span className="line-clamp-2 flex-1 font-heading text-sm font-bold">{n.title || t("notes.untitled")}</span>
                {n.pinned && <Pin className="size-3.5 shrink-0 opacity-70" />}
              </span>
              <span className="line-clamp-4 flex-1 whitespace-pre-wrap break-words text-xs opacity-80">{n.content}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1">
                <StationBadge id={n.station_id} short className="px-1.5 py-0 text-[10px]" />
                {n.shared_stations.length > 0 && <span className="flex items-center gap-0.5 text-[10px] font-semibold opacity-70"><Share2 className="size-3" /> {n.shared_stations.length}</span>}
              </span>
              <span className="text-[10px] opacity-60">{member(n.updated_by)?.first_name ?? ""} · {fmtRelative(n.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
      <Fab icon={Plus} label={t("notes.new")} onClick={() => setEdit("new")} />
      <NoteEditor note={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function NoteEditor({ note, onClose }: { note: Note | "new" | null; onClose: () => void }) {
  const { t, fmtRelative } = useI18n()
  const { me, stations } = useApp()
  const member = useMemberMap()
  const qc = useQueryClient()
  const supabase = createClient()
  const existing = note && note !== "new" ? note : null
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [owner, setOwner] = useState("")
  const [shared, setShared] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!note) return
    setTitle(existing?.title ?? "")
    setContent(existing?.content ?? "")
    setColor(existing?.color ?? null)
    setPinned(existing?.pinned ?? false)
    setOwner(existing?.station_id ?? me.station_id ?? stations[0]?.id ?? "")
    setShared(existing?.shared_stations ?? [])
  }, [note]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only the owner station (or the Uluslararası Yönetim Kurulu) decides who it is shared with.
  const canShare = !existing || isIntl(me) || existing.station_id === me.station_id
  const canDelete = !!existing && (existing.created_by === me.id || isBoard(me))

  async function save() {
    if (!title.trim() && !content.trim()) return toast(t("notes.emptyError"), { error: true })
    setSaving(true)
    const row = { title: title.trim(), content, color, pinned, ...(canShare ? { station_id: owner, shared_stations: shared } : {}) }
    const { error } = existing
      ? await supabase.from("notes").update(row).eq("id", existing.id)
      : await supabase.from("notes").insert({ ...row, created_by: me.id })
    setSaving(false)
    if (error) return toast(t("common.error"), { error: true })
    void qc.invalidateQueries({ queryKey: qk.notes })
    if (shared.length) dispatchPush()
    toast(t("common.saved"))
    onClose()
  }

  async function remove() {
    if (!existing || !confirm(t("notes.confirmDelete"))) return
    const { error } = await supabase.from("notes").delete().eq("id", existing.id)
    if (error) return toast(t("common.error"), { error: true })
    qc.setQueryData<Note[]>(qk.notes, (old) => old?.filter((n) => n.id !== existing.id))
    onClose()
  }

  const others = stations.filter((s) => s.id !== owner)

  return (
    <Sheet
      open={!!note}
      onClose={onClose}
      title={existing ? t("notes.edit") : t("notes.new")}
      footer={
        <div className="flex gap-2">
          {canDelete && <Button variant="ghost" className="text-destructive" onClick={remove} aria-label={t("common.delete")}><Trash2 className="size-4" /></Button>}
          <Button className="flex-1" size="lg" onClick={save} loading={saving}>{t("common.save")}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("notes.titlePlaceholder")} className="font-heading text-base font-bold" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("notes.contentPlaceholder")} rows={10} className="min-h-48 text-[15px] leading-relaxed" />
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c ?? "none"}
              onClick={() => setColor(c)}
              className={cn("size-8 rounded-full border border-border", color === c && "ring-2 ring-primary ring-offset-2 ring-offset-card")}
              style={{ backgroundColor: c ? `hsl(${c})` : "var(--card)" }}
              aria-label={c ?? "default"}
            />
          ))}
          <button onClick={() => setPinned((v) => !v)} className={cn("ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", pinned ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />} {pinned ? t("notes.unpin") : t("notes.pin")}
          </button>
        </div>

        {canShare ? (
          <>
            {isIntl(me) && (
              <Field label={t("notes.owner")}>
                <Chips value={owner} onChange={(v) => { setOwner(v); setShared((s) => s.filter((x) => x !== v)) }} options={stations.map((s) => ({ id: s.id, label: s.city, color: s.color }))} />
              </Field>
            )}
            <Field label={t("notes.shareWith")} hint={t("notes.shareHint")}>
              <div className="flex flex-wrap gap-1.5">
                {others.map((s) => {
                  const on = shared.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => setShared((list) => (on ? list.filter((x) => x !== s.id) : [...list, s.id]))}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", on ? "border-transparent text-white" : "border-border text-muted-foreground")}
                      style={on ? { backgroundColor: `hsl(${s.color})` } : undefined}
                    >
                      {s.city}
                    </button>
                  )
                })}
              </div>
            </Field>
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {t("notes.sharedBy")} <StationBadge id={existing?.station_id} short className="px-1.5 py-0 text-[10px]" />
          </p>
        )}
        {existing && (
          <p className="text-[11px] text-muted-foreground">
            {t("notes.lastEdit", { name: member(existing.updated_by)?.full_name ?? "—", when: fmtRelative(existing.updated_at) })}
          </p>
        )}
      </div>
    </Sheet>
  )
}
