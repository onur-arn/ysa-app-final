"use client"

import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Eye, Heart, Loader2, Music, Plus, Trash2, Volume2, VolumeX, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { Sheet } from "@/components/ui/sheet"
import { MemberAvatar } from "@/components/avatar"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useStories } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isAdmin, isGuest } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { Story } from "@/lib/types"
import { uploadMedia } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { StoryEditor } from "./story-editor"

const SEEN_KEY = "ysa-seen-stories"

export function StoriesBar() {
  const { me, stations, station } = useApp()
  const { t, fmtRelative, fmtDate } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const { data: stories = [] } = useStories()
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer] = useState<{ station: string; mine: boolean; index: number } | null>(null)
  const [viewers, setViewers] = useState<{ user_id: string; viewed_at: string; liked: boolean }[] | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(new Set())

  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"))) } catch {}
  }, [])

  // One bubble per station (v1 behaviour): unseen first, then stations with stories, then the rest.
  const byStation = useMemo(() => {
    const map = new Map<string, Story[]>()
    for (const s of stories) {
      const st = member(s.author_id)?.station_id ?? "intl"
      map.set(st, [...(map.get(st) ?? []), s])
    }
    return map
  }, [stories, member])
  const myStories = stories.filter((s) => s.author_id === me.id)
  const ordered = [...stations].sort((a, b) => {
    const score = (id: string) => ((byStation.get(id) ?? []).some((s) => !seen.has(s.id)) ? 0 : byStation.has(id) ? 1 : 2)
    return score(a.id) - score(b.id)
  })
  const reel = viewer ? (viewer.mine ? myStories : byStation.get(viewer.station) ?? []) : []
  const current = viewer ? reel[viewer.index] : null

  useEffect(() => {
    audioRef.current?.pause()
    if (!current) return
    if (current.music_preview_url) {
      // One reused element: iOS only lets an element started by a tap keep playing on auto-advance.
      const a = (audioRef.current ??= new Audio())
      a.src = current.music_preview_url
      a.muted = muted
      void a.play().catch(() => {})
    }
    void createClient().from("story_views").upsert({ story_id: current.id, user_id: me.id }, { onConflict: "story_id,user_id", ignoreDuplicates: true }).then()
    setSeen((prev) => {
      const next = new Set(prev).add(current.id)
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-300))) } catch {}
      return next
    })
    return () => audioRef.current?.pause()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  function step(dir: 1 | -1) {
    if (!viewer) return
    const i = viewer.index + dir
    if (i >= 0 && i < reel.length) return setViewer({ ...viewer, index: i })
    if (dir === -1) return
    if (viewer.mine) return setViewer(null)
    // continue with the next station that has stories
    const rest = ordered.filter((st) => byStation.has(st.id))
    const next = rest[rest.findIndex((st) => st.id === viewer.station) + 1]
    setViewer(next ? { station: next.id, mine: false, index: 0 } : null)
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) setDraft(URL.createObjectURL(f))
  }

  async function publish(dataUrl: string, fit: "cover" | "contain", musicUrl?: string, musicLabel?: string) {
    setDraft(null)
    setUploading(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const url = await uploadMedia(blob, me.id, "stories", "story.jpg")
      const { error } = await createClient().from("stories").insert({ author_id: me.id, station_id: me.station_id, image_url: url, fit_mode: fit, music_preview_url: musicUrl ?? null, music_label: musicLabel ?? null })
      if (error) throw error
      void qc.invalidateQueries({ queryKey: qk.stories })
      toast(t("stories.added"))
    } catch {
      toast(t("common.error"), { error: true })
    }
    setUploading(false)
  }

  async function remove(s: Story) {
    setPaused(true)
    const ok = confirm(t("story.confirmDelete"))
    setPaused(false)
    if (!ok) return
    setViewer(null)
    qc.setQueryData<Story[]>(qk.stories, (old) => old?.filter((x) => x.id !== s.id))
    await createClient().from("stories").delete().eq("id", s.id)
  }

  async function like(s: Story) {
    await createClient().from("story_views").upsert({ story_id: s.id, user_id: me.id, liked: true }, { onConflict: "story_id,user_id" })
    toast("❤️")
  }

  const author = member(current?.author_id)

  return (
    <>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        <button disabled={isGuest(me)} onClick={() => (myStories.length ? setViewer({ station: me.station_id ?? "intl", mine: true, index: 0 }) : fileRef.current?.click())} className="flex w-16 shrink-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale">
          <span className={cn("relative rounded-full p-[2.5px]", myStories.length ? "bg-primary" : "bg-transparent")}>
            <span className={cn("flex size-16 items-center justify-center overflow-hidden rounded-full border-2", myStories.length ? "border-card" : "border-dashed border-primary/50 bg-primary/5")}>
              {me.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.photo_url} alt="" className="size-full object-cover" />
              ) : myStories.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myStories[myStories.length - 1].image_url} alt="" className="size-full object-cover" />
              ) : (
                <Plus className="size-6 text-primary" />
              )}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (!isGuest(me)) fileRef.current?.click() }}
              className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background"
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" strokeWidth={3} />}
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground">{t("feed.yourStory")}</span>
        </button>
        {ordered.map((st) => {
          const list = byStation.get(st.id) ?? []
          const unseen = list.some((x) => !seen.has(x.id))
          return (
            <button key={st.id} disabled={!list.length} onClick={() => setViewer({ station: st.id, mine: false, index: 0 })} className="flex w-16 shrink-0 flex-col items-center gap-1.5 disabled:cursor-default">
              <span className={cn("relative rounded-full p-[2.5px]", list.length ? (unseen ? "bg-gradient-to-tr from-primary via-sky-400 to-emerald-400" : "bg-border") : "bg-transparent")}>
                {list.length ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={list[list.length - 1].image_url} alt={st.city} className="size-16 rounded-full border-2 border-card object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full border-2 border-card font-heading text-[11px] font-bold tracking-wide text-white" style={{ backgroundColor: `hsl(${st.color})` }}>{st.short}</span>
                )}
                {list.length > 1 && <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">{list.length}</span>}
              </span>
              <span className={cn("w-full truncate text-center text-[11px] font-medium", unseen ? "font-semibold text-foreground" : "text-muted-foreground")}>{st.city}</span>
            </button>
          )
        })}
      </div>

      {draft && <div className="fixed inset-0 z-[60]"><StoryEditor imageUrl={draft} onCancel={() => setDraft(null)} onPublish={publish} /></div>}

      <AnimatePresence>
        {current && viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
            <div className="relative h-full w-full max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.image_url} alt="" className={cn("absolute inset-0 size-full", current.fit_mode === "contain" ? "object-contain" : "object-cover")} />
              <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex gap-1">
                  {reel.map((s, i) => (
                    <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                      {i < viewer.index && <span className="block h-full w-full bg-white" />}
                      {i === viewer.index && <span key={current.id} className={cn("story-progress-bar", paused && "paused")} onAnimationEnd={() => step(1)} />}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-white">
                  <Avatar name={author?.full_name} photoUrl={author?.photo_url} stationId={author?.station_id} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{author?.full_name} <span className="font-normal text-white/70">· {station(author?.station_id)?.city}</span></span>
                    <span className="block text-[11px] text-white/70">{fmtRelative(current.created_at)}</span>
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {current.music_preview_url && (
                      <button onClick={() => setMuted((v) => !v)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="sound">
                        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                      </button>
                    )}
                    {(current.author_id === me.id || isAdmin(me)) && (
                      <button onClick={() => remove(current)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="delete"><Trash2 className="size-4" /></button>
                    )}
                    <button onClick={() => setViewer(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="close"><X className="size-5" /></button>
                  </div>
                </div>
                {current.music_label && (
                  <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur"><Music className="size-3 shrink-0" /><span className="truncate">{current.music_label}</span></p>
                )}
              </div>
              <button className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => step(-1)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="prev" />
              <button className="absolute inset-y-0 right-0 z-10 w-2/3" onClick={() => step(1)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="next" />
              {current.author_id !== me.id ? (
                <button onClick={() => like(current)} className="absolute bottom-8 right-6 z-20 flex size-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="like"><Heart className="size-6" /></button>
              ) : (
                <button
                  onClick={async () => {
                    setPaused(true)
                    const { data } = await createClient().from("story_views").select("user_id, viewed_at, liked").eq("story_id", current.id).neq("user_id", me.id).order("viewed_at", { ascending: false })
                    setViewers(data ?? [])
                  }}
                  className="absolute bottom-8 left-6 z-20 flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur"
                  aria-label={t("story.viewers")}
                >
                  <Eye className="size-5" /> {t("story.viewers")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sheet zClass="z-[70]" open={viewers !== null} onClose={() => { setViewers(null); setPaused(false) }} title={t("story.viewersTitle", { n: viewers?.length ?? 0 })}>
        {viewers && viewers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("story.noViewers")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {viewers?.map((v) => (
              <div key={v.user_id} className="flex items-center gap-3">
                <MemberAvatar id={v.user_id} size={34} showOnline={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{member(v.user_id)?.full_name ?? t("common.formerMember")}</span>
                  <span className="block text-[11px] text-muted-foreground">{fmtDate(v.viewed_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                {v.liked && <Heart className="size-4 shrink-0 fill-red-500 text-red-500" />}
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}
