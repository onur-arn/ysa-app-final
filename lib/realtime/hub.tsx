"use client"

import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useApp } from "@/components/providers/app-context"
import { qk } from "@/lib/data/keys"
import * as f from "@/lib/data/fetchers"
import { createClient } from "@/lib/supabase/client"
import type { Message, Notification } from "@/lib/types"

/**
 * The realtime hub — one Supabase Realtime connection for the whole app.
 *
 *   database change ─► postgres_changes ─► patch / invalidate the TanStack cache
 *
 * Every screen reads from that cache, so a message, task or event created by
 * someone else appears on every page at once, including pages that are not
 * mounted (they render the fresh data as soon as you open them). Presence
 * (who is online) and typing indicators go through the same connection.
 */

type HubContextType = {
  online: Set<string>
  /** subscribe to "typing…" broadcasts of one conversation */
  typingIn: (convId: string) => string[]
  sendTyping: (convId: string) => void
}

const HubContext = createContext<HubContextType>({ online: new Set(), typingIn: () => [], sendTyping: () => {} })
export const useHub = () => useContext(HubContext)
export function useOnline(id: string | null | undefined) {
  const { online } = useContext(HubContext)
  return !!id && online.has(id)
}

export const NOTIFY_EVENT = "ysa-notification"

function debounced(fn: () => void, ms = 120) {
  let t: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (t) clearTimeout(t)
    t = setTimeout(fn, ms)
  }
}

function patchMessage(qc: QueryClient, msg: Message) {
  qc.setQueryData<Message[]>(qk.messages(msg.conversation_id), (old) => {
    if (!old) return old
    const i = old.findIndex((m) => m.id === msg.id)
    if (i >= 0) return old.map((m) => (m.id === msg.id ? { ...msg, message_likes: msg.message_likes ?? m.message_likes } : m))
    return [...old, msg].sort((a, b) => a.created_at.localeCompare(b.created_at))
  })
}

export function RealtimeHub({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { me } = useApp()
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const inv = (key: readonly unknown[]) => debounced(() => void qc.invalidateQueries({ queryKey: key }))
    const refreshFeed = inv(qk.feed)
    const refreshConvs = inv(qk.conversations)
    const refreshTasks = inv(qk.tasks)
    const refreshMembers = inv(qk.members)

    // Warm every main screen so the first navigation is already instant.
    void qc.prefetchQuery({ queryKey: qk.feed, queryFn: f.fetchFeed })
    void qc.prefetchQuery({ queryKey: qk.conversations, queryFn: f.fetchConversations })
    void qc.prefetchQuery({ queryKey: qk.events, queryFn: f.fetchEvents })
    void qc.prefetchQuery({ queryKey: qk.tasks, queryFn: f.fetchTasks })
    void qc.prefetchQuery({ queryKey: qk.stories, queryFn: f.fetchStories })
    void qc.prefetchQuery({ queryKey: qk.notifications, queryFn: f.fetchNotifications })

    let connectedOnce = false
    let cancelled = false
    let ch: RealtimeChannel | null = null
    // realtime-js hands back an existing channel with the same topic, so a remount (React
    // strict mode, account switch) would attach to the one still closing and lose events:
    // wait for any previous "hub" to be fully removed before opening a fresh one.
    const open = async () => {
      for (const old of supabase.getChannels()) if (old.topic === "realtime:hub") await supabase.removeChannel(old)
      if (cancelled) return
      const hub = supabase.channel("hub", { config: { presence: { key: me.id }, broadcast: { self: false } } })
      ch = hub
      subscribeHub(hub)
    }
    const subscribeHub = (ch: RealtimeChannel) => {
      ch
        // ── messaging ─────────────────────────────────────────────────────
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
          if (p.eventType === "DELETE") return refreshConvs()
          patchMessage(qc, p.new as Message)
          refreshConvs()
          const conv = (p.new as Message).conversation_id
          setTyping((t) => (t[conv]?.[(p.new as Message).sender_id ?? ""] ? { ...t, [conv]: { ...t[conv], [(p.new as Message).sender_id!]: 0 } } : t))
          if ((p.new as Message).kind === "poll") void qc.invalidateQueries({ queryKey: qk.polls((p.new as Message).id) })
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "message_likes" }, () => void qc.invalidateQueries({ queryKey: ["messages"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, (p) => {
          const row = (p.new ?? p.old) as { conversation_id?: string }
          refreshConvs()
          if (row.conversation_id) void qc.invalidateQueries({ queryKey: qk.conversation(row.conversation_id) })
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (p) => {
          const row = (p.new ?? p.old) as { id?: string }
          refreshConvs()
          if (row.id) void qc.invalidateQueries({ queryKey: qk.conversation(row.id) })
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => {
          void qc.invalidateQueries({ queryKey: ["poll"] })
          refreshFeed()
        })
        // ── bell ──────────────────────────────────────────────────────────
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (p) => {
          void qc.invalidateQueries({ queryKey: qk.notifications })
          const n = p.new as Notification & { pushed_at?: string | null }
          // INSERT = new alert; UPDATE with pushed_at reset = one more message in a grouped chat entry.
          // (Updates that only mark it read / pushed must not re-trigger the banner.)
          if (p.eventType !== "DELETE" && !n.read_at && (p.eventType === "INSERT" || !n.pushed_at)) {
            window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail: p.new }))
          }
        })
        // ── feed, takvim, görevler, rehber ───────────────────────────────
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, refreshFeed)
        .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, refreshFeed)
        .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, refreshFeed)
        .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, inv(qk.stories))
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, inv(qk.events))
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refreshTasks)
        .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, (p) => {
          const row = (p.new ?? p.old) as { task_id?: string }
          refreshTasks()
          if (row.task_id) void qc.invalidateQueries({ queryKey: qk.taskComments(row.task_id) })
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (p) => {
          refreshMembers()
          if ((p.new as { id?: string })?.id === me.id) void qc.invalidateQueries({ queryKey: qk.me })
        })
        // ── presence & typing ────────────────────────────────────────────
        .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const { conv, user } = payload as { conv: string; user: string }
          setTyping((t) => ({ ...t, [conv]: { ...t[conv], [user]: Date.now() } }))
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void ch.track({ at: Date.now() })
            // After a reconnection, catch up on anything missed while the socket was down.
            if (connectedOnce) void qc.invalidateQueries()
            connectedOnce = true
          }
        })
      channelRef.current = ch
    }
    void open()

    // "Last seen" is written when the app opens and when it goes to the background —
    // live "online" status comes from presence, so no periodic writes are needed.
    const seen = () => void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then()
    const onHide = () => document.visibilityState === "hidden" && seen()
    seen()
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      cancelled = true
      if (ch) void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [qc, me.id])

  // Typing indicators expire after 4 s without news.
  useEffect(() => {
    const t = setInterval(() => setTyping((cur) => (Object.values(cur).some((c) => Object.values(c).some((v) => v && Date.now() - v > 4000)) ? { ...cur } : cur)), 2000)
    return () => clearInterval(t)
  }, [])

  const lastSent = useRef(0)
  const value: HubContextType = {
    online,
    typingIn: (conv) => Object.entries(typing[conv] ?? {}).filter(([, at]) => at && Date.now() - at < 4000).map(([u]) => u),
    sendTyping: (conv) => {
      if (Date.now() - lastSent.current < 2000) return
      lastSent.current = Date.now()
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { conv, user: me.id } })
    },
  }
  return <HubContext.Provider value={value}>{children}</HubContext.Provider>
}
