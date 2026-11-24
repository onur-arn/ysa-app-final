"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowLeft, Pin, Users, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { PhoneButton } from "@/components/phone-actions"
import { ProfileSheet } from "@/components/profile/profile-sheet"
import { EmptyState } from "@/components/ui/misc"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { fetchMessage, fetchMessages, PAGE } from "@/lib/data/fetchers"
import { useConversation, useMemberMap, useMessages } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isAdmin, isIntl } from "@/lib/permissions"
import { deletedClass } from "@/lib/members"
import { dispatchPush } from "@/lib/push"
import { useHub, useOnline } from "@/lib/realtime/hub"
import { createClient } from "@/lib/supabase/client"
import type { ConversationRow, Message, Notification } from "@/lib/types"
import { compressImage, uploadFile, uploadMedia } from "@/lib/upload"
import { cn, isSameDay } from "@/lib/utils"
import { ChatComposer, type Outgoing } from "./chat-composer"
import { ConversationInfo } from "./conversation-info"
import { MessageBubble, type BubbleAction } from "./message-bubble"
import { ForwardSheet } from "@/components/forward-sheet"

export function ChatThread({ id }: { id: string }) {
  const { me, station } = useApp()
  const { t, fmtDate } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const { typingIn } = useHub()
  const { data: conv, isError } = useConversation(id)
  const { data: messages = [], isPending } = useMessages(id)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [info, setInfo] = useState(false)
  const [profile, setProfile] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const [forward, setForward] = useState<Message | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const supabase = createClient()

  const isGroup = conv?.type === "group"
  const otherId = conv?.type === "dm" ? conv.conversation_members.find((m) => m.user_id !== me.id)?.user_id : null
  const other = member(otherId)
  const otherOnline = useOnline(otherId)
  const otherRead = conv?.conversation_members.find((m) => m.user_id === otherId)?.last_read_at
  const memberIds = useMemo(() => conv?.conversation_members.map((m) => m.user_id) ?? [], [conv])
  const modView = isAdmin(me) && !!conv && !memberIds.includes(me.id) // admin reviewing a reported conversation (read-only)
  const typers = typingIn(id).filter((u) => u !== me.id)
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  // ── read state: clear unread badge + bell entry as soon as messages are seen
  const markRead = useCallback(() => {
    qc.setQueryData<ConversationRow[]>(qk.conversations, (old) => old?.map((c) => (c.id === id ? { ...c, unread: 0, mentioned: false } : c)))
    qc.setQueryData<Notification[]>(qk.notifications, (old) => old?.map((n) => (n.link === `/messages/${id}` && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)))
    void supabase.rpc("mark_read", { cid: id }).then() // query builders are lazy: .then() sends it
  }, [id, qc]) // eslint-disable-line react-hooks/exhaustive-deps

  const last = messages[messages.length - 1]
  useEffect(() => {
    if (!modView && document.visibilityState === "visible" && (!last || last.sender_id !== me.id)) markRead()
  }, [last?.id, markRead]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && markRead()
    document.addEventListener("visibilitychange", on)
    return () => document.removeEventListener("visibilitychange", on)
  }, [markRead])

  // ── scrolling
  useLayoutEffect(() => {
    if (stick.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, typers.length])

  // The keyboard opening/closing resizes the list: stay on the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // On opening a conversation, land at the very bottom. Retry across frames so
  // late-loading media (images, audio players) can't leave the view above it.
  const booted = useRef<string | null>(null)
  const bootedAt = useRef(Number.POSITIVE_INFINITY)
  useEffect(() => {
    if (!messages.length || booted.current === id) return
    booted.current = id
    bootedAt.current = Date.now()
    stick.current = true
    setAtBottom(true)
    const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }
    toBottom()
    const r = requestAnimationFrame(toBottom)
    const t1 = setTimeout(toBottom, 120)
    const t2 = setTimeout(toBottom, 350)
    return () => { cancelAnimationFrame(r); clearTimeout(t1); clearTimeout(t2) }
  }, [id, messages.length])

  function onScroll() {
    const el = scrollRef.current!
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    stick.current = bottom
    setAtBottom(bottom)
    if (el.scrollTop < 80 && hasMore && messages.length >= PAGE) void loadOlder()
  }

  const loadingOlder = useRef(false)
  async function loadOlder() {
    if (loadingOlder.current || !messages[0]) return
    loadingOlder.current = true
    const el = scrollRef.current!
    const before = el.scrollHeight
    const older = await fetchMessages(id, messages[0].created_at)
    qc.setQueryData<Message[]>(qk.messages(id), (old = []) => [...older.filter((o) => !old.some((m) => m.id === o.id)), ...old])
    setHasMore(older.length >= PAGE)
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - before
      loadingOlder.current = false
    })
  }

  function jump(mid: string) {
    const el = document.getElementById(`msg-${mid}`)
    if (!el) return toast(t("messages.olderNotLoaded"))
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlight(mid)
    setTimeout(() => setHighlight(null), 1600)
  }

  // ── pinned message (📌 Uluslararası Büro only)
  const pinnedId = conv?.pinned_message_id ?? null
  const { data: pinned } = useQuery({
    queryKey: ["message", pinnedId],
    queryFn: () => fetchMessage(pinnedId!),
    enabled: !!pinnedId,
    initialData: pinnedId ? byId.get(pinnedId) : undefined,
  })
  async function pin(mid: string | null) {
    const { error } = await supabase.rpc("pin_message", { cid: id, mid })
    if (error) return toast(t("messages.pinDenied"), { error: true })
    void qc.invalidateQueries({ queryKey: qk.conversation(id) })
    toast(mid ? t("messages.pinned") : t("messages.unpinned"))
  }

  // ── sending (optimistic: the bubble shows immediately, then gets confirmed)
  async function send(o: Outgoing) {
    stick.current = true
    const temp: Message = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`, conversation_id: id, sender_id: me.id, kind: o.kind, content: null, attachment_url: null,
      attachment_name: null, attachment_size: null, mentions: [], reply_to: replyTo?.id ?? null, deleted_at: null, created_at: new Date().toISOString(), pending: true,
    }
    const row: Partial<Message> = { conversation_id: id, sender_id: me.id, kind: o.kind, reply_to: replyTo?.id ?? null }
    if (o.kind === "text") Object.assign(row, { content: o.content, mentions: o.mentions })
    if (o.kind === "gif") row.attachment_url = o.url
    if (o.kind === "poll") row.content = o.question
    const preview = { ...temp, ...row, attachment_url: o.kind === "image" ? URL.createObjectURL(o.file) : row.attachment_url ?? null, attachment_name: o.kind === "file" ? o.file.name : null }
    const put = (fn: (old: Message[]) => Message[]) => qc.setQueryData<Message[]>(qk.messages(id), (old = []) => fn(old))
    put((old) => [...old, preview as Message])
    setReplyTo(null)
    // land on the message just sent, even once the layout settles (keyboard, media)
    const toBottom = () => { const el = scrollRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight }
    requestAnimationFrame(toBottom)
    setTimeout(toBottom, 150)
    setTimeout(toBottom, 400)

    try {
      if (o.kind === "image") row.attachment_url = await uploadMedia(await compressImage(o.file), me.id, "chat")
      if (o.kind === "file") Object.assign(row, { attachment_url: await uploadFile(o.file, id), attachment_name: o.file.name, attachment_size: o.file.size })
      if (o.kind === "audio") row.attachment_url = await uploadMedia(o.blob, me.id, "voice", "voice.webm")
      const { data, error } = await supabase.from("messages").insert(row).select().single()
      if (error) throw error
      if (o.kind === "poll") {
        const { data: poll, error: pe } = await supabase.from("polls").insert({ message_id: data.id, question: o.question, multiple: o.multiple }).select("id").single()
        if (pe) throw pe
        await supabase.from("poll_options").insert(o.options.map((label, position) => ({ poll_id: poll.id, label, position })))
        void qc.invalidateQueries({ queryKey: qk.polls(data.id) })
      }
      put((old) => [...old.filter((m) => m.id !== temp.id && m.id !== data.id), data as Message].sort((a, b) => a.created_at.localeCompare(b.created_at)))
      dispatchPush()
    } catch (e) {
      put((old) => old.filter((m) => m.id !== temp.id))
      throw e
    }
  }

  async function remove(m: Message) {
    if (!confirm(t("messages.confirmDelete"))) return
    qc.setQueryData<Message[]>(qk.messages(id), (old) => old?.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), content: null } : x)))
    await supabase.from("messages").update({ deleted_at: new Date().toISOString(), content: null, attachment_url: null }).eq("id", m.id)
  }

  // One stable callback for every bubble (lets React skip re-rendering unchanged bubbles).
  const handlers = useRef({ setReplyTo, pin, remove, jump, setForward })
  handlers.current = { setReplyTo, pin, remove, jump, setForward }
  const onAction = useCallback((action: BubbleAction, m: Message, target?: string) => {
    const h = handlers.current
    if (action === "reply") h.setReplyTo(m)
    else if (action === "pin") void h.pin(m.id)
    else if (action === "delete") void h.remove(m)
    else if (action === "jump" && target) h.jump(target)
    else if (action === "forward") h.setForward(m)
  }, [])
  const onMediaLoad = useCallback(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [])

  if (isError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center">
        <EmptyState icon={Users} title={t("messages.notFound")} action={<Link href="/messages" className="text-sm font-semibold text-primary">← {t("nav.messages")}</Link>} />
      </div>
    )
  }

  const title = conv ? (isGroup ? conv.name ?? t("messages.group") : other?.full_name ?? t("common.formerMember")) : ""
  const subtitle = typers.length
    ? isGroup ? t("messages.typingNames", { names: typers.map((u) => member(u)?.first_name).join(", ") }) : t("messages.typing")
    : isGroup ? t("messages.membersCount", { n: memberIds.length }) : otherOnline ? t("common.online") : other?.position ?? ""

  return (
    <div className="flex h-dvh flex-col md:h-[calc(100dvh-61px)]">
      {/* header */}
      <div className="relative z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <Link href="/messages" className="flex size-10 items-center justify-center rounded-full hover:bg-secondary" aria-label="back"><ArrowLeft className="size-5" /></Link>
        <button onClick={() => (isGroup ? setInfo(true) : otherId && setProfile(otherId))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {!conv ? (
            <span className="size-10 animate-pulse rounded-full bg-secondary" />
          ) : isGroup ? (
            conv.avatar_url ? <Avatar name={conv.name} photoUrl={conv.avatar_url} size={40} /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Users className="size-5" /></span>
          ) : (
            <MemberAvatar id={otherId} size={40} />
          )}
          <span className="min-w-0">
            <span className={cn("block truncate font-heading text-[15px] font-bold text-foreground", !isGroup && deletedClass(other))}>{title}</span>
            <span className={cn("block truncate text-xs", typers.length || (!isGroup && otherOnline) ? "font-medium text-primary" : "text-muted-foreground")}>{subtitle}</span>
          </span>
        </button>
        {!isGroup && other && <PhoneButton phone={other.phone} />}
      </div>

      {/* pinned */}
      {pinnedId && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-3 py-2 backdrop-blur">
          <button onClick={() => jump(pinnedId)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Pin className="size-4" /></span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-primary">{t("messages.pinnedBy", { name: member(conv?.pinned_by)?.first_name ?? "" })}</span>
              <span className="block truncate text-sm text-foreground">{pinned ? pinned.deleted_at ? t("messages.deleted") : pinned.content ?? pinned.attachment_name ?? t(`messages.kind.${pinned.kind}`) : "…"}</span>
            </span>
          </button>
          {isIntl(me) && <button onClick={() => pin(null)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label={t("messages.unpin")}><X className="size-4" /></button>}
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="chat-bg relative flex-1 select-none overflow-y-auto overscroll-contain px-3 pb-4 pt-2 [-webkit-touch-callout:none]">
        {isPending && messages.length === 0 ? (
          <div className="flex flex-col gap-3 pt-4">
            {[50, 70, 40, 60].map((w, i) => <div key={i} className={cn("h-10 animate-pulse rounded-3xl bg-secondary", i % 2 ? "self-end" : "self-start")} style={{ width: `${w}%` }} />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">{t("messages.sayHello")}</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="sticky top-1 z-[5] my-3 flex justify-center">
                    <span className="rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-md">{fmtDate(m.created_at, { weekday: "long", day: "numeric", month: "long" })}</span>
                  </div>
                )}
                <MessageBubble
                  m={m}
                  prev={newDay ? undefined : prev}
                  next={messages[i + 1]}
                  isGroup={!!isGroup}
                  reply={m.reply_to ? byId.get(m.reply_to) ?? null : null}
                  canPin={isIntl(me)}
                  readByOther={!isGroup && !!otherRead && otherRead >= m.created_at}
                  highlight={highlight === m.id}
                  isNew={new Date(m.created_at).getTime() > bootedAt.current}
                  onAction={onAction}
                  onMediaLoad={onMediaLoad}
                />
              </div>
            )
          })
        )}
        {typers.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {typers.map((uid) => {
              const color = station(member(uid)?.station_id)?.color
              return (
                <div key={uid} className="flex items-end gap-2">
                  {isGroup && <MemberAvatar id={uid} size={28} showOnline={false} />}
                  <span
                    className="flex items-center gap-1 rounded-3xl rounded-bl-lg bg-card px-4 py-3 shadow-sm ring-1 ring-border/60"
                    style={isGroup && color ? { boxShadow: `inset 3px 0 0 hsl(${color})` } : undefined}
                  >
                    {[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s`, backgroundColor: isGroup && color ? `hsl(${color})` : undefined }} />)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!atBottom && (
        <button onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })} className="absolute bottom-24 right-5 z-10 flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg" aria-label="bottom">
          <ArrowDown className="size-5" />
        </button>
      )}

      {modView ? (
        <div className="flex items-center gap-2 border-t border-amber-500/30 bg-amber-500/8 px-4 py-3 text-xs text-amber-700">
          <span>{t("mod.banner")}</span>
        </div>
      ) : (
        <ChatComposer convId={id} memberIds={memberIds} isGroup={!!isGroup} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSend={send} />
      )}

      <ForwardSheet message={forward} onClose={() => setForward(null)} />
      {conv && <ConversationInfo open={info} onClose={() => setInfo(false)} conv={conv} onOpenProfile={(uid) => { setInfo(false); setProfile(uid) }} />}
      <ProfileSheet memberId={profile} onClose={() => setProfile(null)} />
    </div>
  )
}
