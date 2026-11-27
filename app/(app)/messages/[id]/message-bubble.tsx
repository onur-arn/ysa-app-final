"use client"

import { Linkified } from "@/components/linkified"
import { ProfileLink } from "@/components/profile/profile-link"
import { Check, CheckCheck, Clock, Copy, CornerUpLeft, Flag, Forward, Heart, Pencil, Pin, Star, StarOff, Trash2, Users } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { memo, useRef, useState, type ReactNode } from "react"
import { AudioMessage } from "@/components/audio-message"
import { MemberAvatar } from "@/components/avatar"
import { FileChip } from "@/components/file-chip"
import { FORWARDABLE } from "@/components/forward-sheet"
import { useImageViewer } from "@/components/image-viewer"
import { PollView } from "@/components/poll-view"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useMessagePoll } from "@/lib/data/hooks"
import { deletedClass } from "@/lib/members"
import { isAdmin } from "@/lib/permissions"
import { ReportSheet, type ReportTarget } from "@/components/report-sheet"
import { qk } from "@/lib/data/keys"
import { createClient } from "@/lib/supabase/client"
import { Sheet } from "@/components/ui/sheet"
import { useI18n } from "@/lib/i18n/context"
import type { Member, Message, Poll } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Highlights "@Full Name" for every mentioned member, in that member's station colour. */
export function MentionText({ text, mentions, inverted }: { text: string; mentions: string[]; inverted?: boolean }) {
  const member = useMemberMap()
  const { station, me } = useApp()
  const people = mentions.map((id) => member(id)).filter(Boolean) as Member[]
  if (!people.length) return <Linkified text={text} />
  const names = people.map((p) => p.full_name).sort((a, b) => b.length - a.length)
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g")
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(<Linkified key={`t${last}`} text={text.slice(last, m.index)} />)
    const who = people.find((p) => p.full_name === m[1])!
    const color = station(who.station_id)?.color ?? "188 57% 48%"
    parts.push(
      <ProfileLink key={m.index} id={who.id}>
        <span
          className={cn("rounded-md px-1 font-semibold", who.id === me.id && "ring-1 ring-current")}
          style={inverted ? { backgroundColor: "rgb(255 255 255 / 0.22)" } : { color: `hsl(${color})`, backgroundColor: `hsl(${color} / 0.12)` }}
        >
          @{m[1]}
        </span>
      </ProfileLink>,
    )
    last = m.index! + m[0].length
  }
  parts.push(<Linkified key={`t${last}`} text={text.slice(last)} />)
  return <>{parts}</>
}

function ChatPoll({ message, inverted }: { message: Message; inverted: boolean }) {
  const { data: poll } = useMessagePoll(message.id)
  const qc = useQueryClient()
  if (!poll) return <p className="text-sm opacity-70">📊 {message.content}</p>
  return <PollView poll={poll} inverted={inverted} onChanged={(next: Poll) => qc.setQueryData(qk.polls(message.id), next)} />
}

/** The 5 reactions offered on a message (one per member, like WhatsApp). Same list as the SQL check. */
export const REACTIONS = ["❤️", "👍", "😂", "😮", "🙏"] as const
const emojiOf = (l: { emoji?: string }) => l.emoji ?? "❤️"

export type BubbleAction = "reply" | "pin" | "delete" | "jump" | "forward" | "edit" | "star"

type BubbleProps = {
  m: Message
  prev?: Message
  next?: Message
  isGroup: boolean
  reply?: Message | null
  canPin: boolean
  readByOther: boolean
  highlight: boolean
  /** ⭐ marked as important by me */
  starred?: boolean
  /** arrived while the conversation was open: animate its entrance */
  isNew?: boolean
  /** stable callback (same function on every render) so bubbles can be memoised */
  onAction: (action: BubbleAction, m: Message, targetId?: string) => void
  onMediaLoad?: () => void
}

export const MessageBubble = memo(function MessageBubble({ m, prev, next, isGroup, reply, canPin, readByOther, highlight, starred, isNew, onAction, onMediaLoad }: BubbleProps) {
  const { me, station } = useApp()
  const member = useMemberMap()
  const { t, fmtDate } = useI18n()
  const qc = useQueryClient()
  const viewer = useImageViewer()
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const [burst, setBurst] = useState<{ n: number; emoji: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressed = useRef(false)
  const lastTap = useRef(0)
  // swipe right on a bubble → reply (like WhatsApp)
  const rowRef = useRef<HTMLDivElement>(null)
  const replyHint = useRef<HTMLSpanElement>(null)
  const touch = useRef({ x: 0, y: 0, dx: 0, swiping: false })
  const [showLikes, setShowLikes] = useState(false)
  const likes = m.message_likes ?? []
  const myReaction = likes.find((l) => l.user_id === me.id)
  // most used first, at most 3 shown on the badge
  const counts = REACTIONS.map((e) => ({ e, n: likes.filter((l) => emojiOf(l) === e).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  const mine = m.sender_id === me.id

  /** Same emoji as mine → removes it; another one → replaces it (one reaction per person). */
  async function react(emoji: string = "❤️") {
    if (m.deleted_at || m.pending || m.kind === "system") return
    const removing = myReaction && emojiOf(myReaction) === emoji
    if (!removing) setBurst((b) => ({ n: (b?.n ?? 0) + 1, emoji }))
    const others = likes.filter((l) => l.user_id !== me.id)
    const updated = removing ? others : [...others, { user_id: me.id, emoji }]
    qc.setQueryData<Message[]>(qk.messages(m.conversation_id), (old) => old?.map((x) => (x.id === m.id ? { ...x, message_likes: updated } : x)))
    const sb = createClient()
    const { error } = removing
      ? await sb.from("message_likes").delete().eq("message_id", m.id).eq("user_id", me.id)
      : await sb.from("message_likes").upsert({ message_id: m.id, user_id: me.id, emoji }, { onConflict: "message_id,user_id" })
    if (error) void qc.invalidateQueries({ queryKey: qk.messages(m.conversation_id) })
  }
  // double-tap: ❤️ (or removes my reaction, whatever it is)
  const toggleLike = () => (myReaction && emojiOf(myReaction) !== "❤️" ? react(emojiOf(myReaction)) : react("❤️"))

  const sender = member(m.sender_id)
  const color = station(sender?.station_id)?.color ?? "188 57% 48%"
  const firstOfGroup = !prev || prev.sender_id !== m.sender_id || prev.kind === "system" || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
  const lastOfGroup = !next || next.sender_id !== m.sender_id || next.kind === "system"

  if (m.kind === "system") return <p className="my-2 text-center text-xs text-muted-foreground">{m.content}</p>

  const media = m.kind === "image" || m.kind === "gif"
  const canForward = !m.deleted_at && !m.pending && FORWARDABLE.has(m.kind)
  // Long press opens the action sheet; it never selects text (select-none + no iOS callout).
  const canSwipe = !m.deleted_at && !m.pending
  const setShift = (px: number, animate: boolean) => {
    const row = rowRef.current
    if (row) {
      row.style.transition = animate ? "transform 180ms ease-out" : "none"
      row.style.transform = px ? `translateX(${px}px)` : ""
    }
    if (replyHint.current) replyHint.current.style.opacity = String(Math.min(1, px / 55))
  }
  const longPress = {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setMenu(true) },
    onTouchStart: (e: React.TouchEvent) => {
      pressed.current = false
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, swiping: false }
      press.current = setTimeout(() => { pressed.current = true; setMenu(true) }, 380)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const dx = e.touches[0].clientX - touch.current.x
      const dy = e.touches[0].clientY - touch.current.y
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) press.current && clearTimeout(press.current)
      if (!canSwipe) return
      if (!touch.current.swiping && dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.6) touch.current.swiping = true
      if (touch.current.swiping) {
        touch.current.dx = Math.max(0, Math.min(dx * 0.6, 80))
        setShift(touch.current.dx, false)
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (press.current) clearTimeout(press.current)
      if (touch.current.swiping) {
        if (touch.current.dx >= 50) { navigator.vibrate?.(10); onAction("reply", m) }
        touch.current.swiping = false
        setShift(0, true)
        return
      }
      if (pressed.current) { e.preventDefault(); return } // the long press already opened the menu
      const now = Date.now()
      if (now - lastTap.current < 300) { lastTap.current = 0; void toggleLike() } // double-tap to like
      else lastTap.current = now
    },
    onDoubleClick: () => void toggleLike(),
  }
  const act = (fn: () => void) => () => { setMenu(false); fn() }

  return (
    <motion.div
      id={`msg-${m.id}`}
      initial={isNew ? { opacity: 0, y: 10, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("msg-row group flex items-end gap-2", mine ? "justify-end" : "justify-start", firstOfGroup ? "mt-3" : "mt-[3px]", likes.length > 0 && "mb-2.5")}
    >
      {!mine && isGroup && <span className="w-8 shrink-0">{lastOfGroup && <ProfileLink id={m.sender_id}><MemberAvatar id={m.sender_id} size={32} showOnline={false} /></ProfileLink>}</span>}
      <div ref={rowRef} className={cn("relative max-w-[78%]", highlight && "animate-pulse")}>
        <span ref={replyHint} className="pointer-events-none absolute -left-9 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground opacity-0"><CornerUpLeft className="size-4" /></span>
        <div
          {...longPress}
          className={cn(
            "relative select-none rounded-[22px] [-webkit-touch-callout:none] [-webkit-user-select:none]",
            media ? "overflow-hidden p-0" : "px-3.5 py-2",
            mine
              ? cn("bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]", lastOfGroup && "rounded-br-md")
              : cn("bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-border/50", lastOfGroup && "rounded-bl-md"),
            m.pending && "opacity-70",
            menu && "scale-[0.98] brightness-95",
            "transition-[transform,filter] duration-150",
          )}
          style={!mine && isGroup ? { boxShadow: `inset 3px 0 0 hsl(${color})` } : undefined}
        >
          {!mine && isGroup && firstOfGroup && (
            <p className={cn("mb-0.5 text-[12px] font-bold", media && "px-3.5 pt-2", deletedClass(sender))} style={{ color: `hsl(${color})` }}>
              <ProfileLink id={m.sender_id}>{sender?.full_name ?? t("common.formerMember")}</ProfileLink>
              <span className="ml-1.5 text-[10px] font-semibold opacity-70">{station(sender?.station_id)?.short}</span>
            </p>
          )}
          {m.forwarded && !m.deleted_at && (
            <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] italic", mine ? "text-primary-foreground/75" : "text-muted-foreground", media && "px-3.5 pt-2")}>
              <Forward className="size-3" /> {t("messages.forwardedLabel")}
            </p>
          )}
          {reply && (
            <button onClick={() => onAction("jump", m, reply.id)} className={cn("mb-1.5 block w-full rounded-xl border-l-[3px] px-2 py-1 text-left text-xs", media && "mx-2 mt-2 w-auto", mine ? "border-primary-foreground/70 bg-primary-foreground/12" : "bg-secondary")} style={!mine ? { borderColor: `hsl(${station(member(reply.sender_id)?.station_id)?.color ?? color})` } : undefined}>
              <p className="font-semibold">{member(reply.sender_id)?.full_name}</p>
              <p className="line-clamp-1 opacity-80">{reply.deleted_at ? t("messages.deleted") : reply.content ?? reply.attachment_name ?? t(`messages.kind.${reply.kind}`)}</p>
            </button>
          )}
          {m.deleted_at ? (
            <p className="text-sm italic opacity-70">{t("messages.deleted")}</p>
          ) : (
            <>
              {media && m.attachment_url && (
                <button
                  type="button"
                  onClick={() => !pressed.current && viewer.open(m.attachment_url!)}
                  className={cn("block bg-secondary/60", !loaded && "min-h-48 w-60")}
                  aria-label={t("messages.photo")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.attachment_url}
                    alt=""
                    draggable={false}
                    onLoad={() => { setLoaded(true); onMediaLoad?.() }}
                    className={cn("max-h-80 min-w-40 object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
                    loading="lazy"
                  />
                </button>
              )}
              {m.kind === "file" && m.attachment_url && <FileChip path={m.attachment_url} name={m.attachment_name ?? "dosya"} size={m.attachment_size} inverted={mine} />}
              {m.kind === "audio" && m.attachment_url && <AudioMessage src={m.attachment_url} self={mine} />}
              {m.kind === "poll" && <ChatPoll message={m} inverted={mine} />}
              {m.content && m.kind !== "poll" && (
                <p className={cn("whitespace-pre-wrap break-words text-[15px] leading-[1.35]", media && "px-3.5 py-2", m.kind === "file" && "mt-1.5")}>
                  <MentionText text={m.content} mentions={m.mentions} inverted={mine} />
                </p>
              )}
            </>
          )}
          <p className={cn("flex items-center justify-end gap-1 text-[10px] tabular-nums", mine ? "text-primary-foreground/75" : "text-muted-foreground", media ? "px-3 pb-1.5" : "mt-0.5")}>
            {starred && <Star className="size-2.5 fill-current" />}
            {m.edited_at && !m.deleted_at && <span className="italic">{t("messages.edited")}</span>}
            {fmtDate(m.created_at, { hour: "2-digit", minute: "2-digit" })}
            {mine && (m.pending ? <Clock className="size-3" /> : readByOther ? <CheckCheck className="size-3.5 text-sky-300" /> : <Check className="size-3" />)}
          </p>

          {/* double-tap heart */}
          <AnimatePresence>
            {burst && (
              <motion.span
                key={burst.n}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.1] }}
                transition={{ duration: 0.7, times: [0, 0.25, 0.7, 1] }}
                onAnimationComplete={() => setBurst(null)}
              >
                <span className="text-4xl drop-shadow">{burst.emoji}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {likes.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowLikes(true) }}
            className={cn("absolute -bottom-3 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-[3px] text-[10px] font-semibold shadow-sm active:scale-95", mine ? "left-2" : "right-2")}
            aria-label={t("messages.reactions")}
          >
            <span className="flex text-[12px] leading-none">{counts.slice(0, 3).map((c) => <span key={c.e}>{c.e}</span>)}</span>
            {likes.length > 1 && <span className="text-foreground">{likes.length}</span>}
          </button>
        )}
      </div>
      <button onClick={() => setMenu(true)} className="mb-2 hidden text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" aria-label="menu">⋯</button>

      {/* actions (long press) */}
      <Sheet open={menu} onClose={() => setMenu(false)}>
        {!m.deleted_at && !m.pending && (
          <div className="mb-3 flex justify-between rounded-full bg-secondary/60 px-2 py-1.5">
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={act(() => void react(e))}
                className={cn("flex size-12 items-center justify-center rounded-full text-[28px] transition-transform active:scale-90", myReaction && emojiOf(myReaction) === e && "bg-primary/15 ring-2 ring-primary/40")}
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <QuickAction icon={CornerUpLeft} label={t("messages.reply")} onClick={act(() => onAction("reply", m))} disabled={!!m.deleted_at} />
          <QuickAction icon={Forward} label={t("messages.forward")} onClick={act(() => onAction("forward", m))} disabled={!canForward} />
          <QuickAction icon={Copy} label={t("messages.copy")} onClick={act(() => void navigator.clipboard?.writeText(m.content ?? ""))} disabled={!m.content || !!m.deleted_at} />
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/60">
          {!m.deleted_at && !m.pending && <MenuItem icon={starred ? StarOff : Star} onClick={act(() => onAction("star", m))}>{starred ? t("messages.unstar") : t("messages.star")}</MenuItem>}
          {mine && m.kind === "text" && !m.deleted_at && !m.pending && <MenuItem icon={Pencil} onClick={act(() => onAction("edit", m))}>{t("common.edit")}</MenuItem>}
          {likes.length > 0 && <MenuItem icon={Users} onClick={act(() => setShowLikes(true))}>{t("messages.reactions")} · {likes.length}</MenuItem>}
          {canPin && !m.deleted_at && <MenuItem icon={Pin} onClick={act(() => onAction("pin", m))}>{t("messages.pin")}</MenuItem>}
          {!mine && !m.deleted_at && <MenuItem icon={Flag} onClick={act(() => setReport({ kind: "message", targetId: m.id, conversationId: m.conversation_id, label: member(m.sender_id)?.full_name ?? "" }))}>{t("report.action")}</MenuItem>}
          {(mine || isAdmin(me)) && !m.deleted_at && <MenuItem icon={Trash2} danger onClick={act(() => onAction("delete", m))}>{t("common.delete")}</MenuItem>}
        </div>
      </Sheet>

      <ReportSheet target={report} onClose={() => setReport(null)} />
      <Sheet open={showLikes} onClose={() => setShowLikes(false)} title={t("messages.reactions")}>
        <LikersList ids={likes.map((l) => l.user_id)} emojis={Object.fromEntries(likes.map((l) => [l.user_id, emojiOf(l)]))} />
      </Sheet>
    </motion.div>
  )
})

/** People who liked a message or a post. */
export function LikersList({ ids, emojis }: { ids: string[]; emojis?: Record<string, string> }) {
  const member = useMemberMap()
  const { station } = useApp()
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-1">
      {ids.map((id) => {
        const p = member(id)
        return (
          <ProfileLink key={id} id={id} className="flex items-center gap-3 rounded-2xl px-1 py-1.5 active:bg-secondary">
            <MemberAvatar id={id} size={40} showOnline={false} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-[15px] font-medium text-foreground", deletedClass(p))}>{p?.full_name ?? t("common.formerMember")}</span>
              {p && <span className="block truncate text-xs text-muted-foreground">{station(p.station_id)?.name ?? ""}</span>}
            </span>
            {emojis?.[id] ? <span className="shrink-0 text-xl">{emojis[id]}</span> : <Heart className="size-4 shrink-0 fill-red-500 text-red-500" />}
          </ProfileLink>
        )
      })}
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary/60 py-3 text-xs font-medium text-foreground transition-colors active:bg-secondary disabled:opacity-35">
      <Icon className="size-5" /> {label}
    </button>
  )
}

function MenuItem({ icon: Icon, onClick, children, danger }: { icon: React.ComponentType<{ className?: string }>; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors active:bg-secondary", danger && "text-destructive")}>
      <Icon className="size-4" /> {children}
    </button>
  )
}
