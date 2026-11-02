"use client"

import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Heart, Loader2, Music, Plus, Trash2, Volume2, VolumeX, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useStories } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { Story } from "@/lib/types"
import { uploadMedia } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { StoryEditor } from "./story-editor"

const SEEN_KEY = "ysa-seen-stories"

export function StoriesBar() {
  const { me } = useApp()
  const { t, fmtRelative } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const { data: stories = [] } = useStories()
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer] = useState<{ author: number; index: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(new Set())

  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"))) } catch {}
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, Story[]>()
    for (const s of stories) map.set(s.author_id, [...(map.get(s.author_id) ?? []), s])
    return [...map.values()].sort((a, b) => (a[0].author_id === me.id ? -1 : b[0].author_id === me.id ? 1 : 0))
  }, [stories, me.id])
  const current = viewer ? groups[viewer.author]?.[viewer.index] : null

  useEffect(() => {
    audioRef.current?.pause()
    if (!current) return
    if (current.music_preview_url) {
      const a = new Audio(current.music_preview_url)
      a.muted = muted
      void a.play().catch(() => {})
      audioRef.current = a
    }
    void createClient().from("story_views").upsert({ story_id: current.id, user_id: me.id }, { onConflict: "story_id,user_id", ignoreDuplicates: true })
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
    const g = groups[viewer.author]
    const i = viewer.index + dir
    if (i >= 0 && i < g.length) return setViewer({ ...viewer, index: i })
    const a = viewer.author + dir
    if (a >= 0 && a < groups.length) return setViewer({ author: a, index: dir === 1 ? 0 : groups[a].length - 1 })
    setViewer(null)
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
    setViewer(null)
    qc.setQueryData<Story[]>(qk.stories, (old) => old?.filter((x) => x.id !== s.id))
    await createClient().from("stories").delete().eq("id", s.id)
  }

  async function like(s: Story) {
    await createClient().from("story_views").upsert({ story_id: s.id, user_id: me.id, liked: true }, { onConflict: "story_id,user_id" })
    toast("❤️")
  }

  const hasMine = groups[0]?.[0]?.author_id === me.id
  const author = member(current?.author_id)

  return (
    <>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        {!hasMine && (
          <button onClick={() => fileRef.current?.click()} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="relative">
              <Avatar name={me.full_name} photoUrl={me.photo_url} stationId={me.station_id} size={60} />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                {uploading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" strokeWidth={3} />}
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground">{t("feed.yourStory")}</span>
          </button>
        )}
        {groups.map((g, i) => {
          const a = member(g[0].author_id)
          const unseen = g.some((s) => !seen.has(s.id))
          const mine = g[0].author_id === me.id
          return (
            <div key={g[0].author_id} className="relative flex w-16 shrink-0 flex-col items-center gap-1">
              <button onClick={() => setViewer({ author: i, index: 0 })}>
                <span className={cn("block rounded-full p-[2.5px]", unseen ? "bg-gradient-to-tr from-primary via-sky-400 to-emerald-400" : "bg-border")}>
                  <span className="block rounded-full bg-background p-[2px]"><Avatar name={a?.full_name} photoUrl={a?.photo_url} stationId={a?.station_id} size={52} /></span>
                </span>
              </button>
              {mine && (
                <button onClick={() => fileRef.current?.click()} className="absolute right-0 top-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background" aria-label="add">
                  {uploading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" strokeWidth={3} />}
                </button>
              )}
              <span className="w-full truncate text-center text-[11px] font-medium text-muted-foreground">{mine ? t("feed.yourStory") : a?.first_name}</span>
            </div>
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
              <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex gap-1">
                  {groups[viewer.author].map((s, i) => (
                    <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                      {i < viewer.index && <span className="block h-full w-full bg-white" />}
                      {i === viewer.index && <span key={current.id} className={cn("story-progress-bar", paused && "paused")} onAnimationEnd={() => step(1)} />}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-white">
                  <Avatar name={author?.full_name} photoUrl={author?.photo_url} stationId={author?.station_id} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{author?.full_name}</span>
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
              <button className="absolute inset-y-0 left-0 w-1/3" onClick={() => step(-1)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="prev" />
              <button className="absolute inset-y-0 right-0 w-2/3" onClick={() => step(1)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="next" />
              {current.author_id !== me.id && (
                <button onClick={() => like(current)} className="absolute bottom-8 right-6 flex size-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="like"><Heart className="size-6" /></button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
