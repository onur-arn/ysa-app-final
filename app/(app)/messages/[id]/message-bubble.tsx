"use client"

import { Check, CheckCheck, Clock, Copy, CornerUpLeft, Pin, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { useRef, useState, type ReactNode } from "react"
import { AudioMessage } from "@/components/audio-message"
import { MemberAvatar } from "@/components/avatar"
import { FileChip } from "@/components/file-chip"
import { PollView } from "@/components/poll-view"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useMessagePoll } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import type { Member, Message, Poll } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Highlights "@Full Name" for every mentioned member, in that member's station colour. */
export function MentionText({ text, mentions, inverted }: { text: string; mentions: string[]; inverted?: boolean }) {
  const member = useMemberMap()
  const { station, me } = useApp()
  const people = mentions.map((id) => member(id)).filter(Boolean) as Member[]
  if (!people.length) return <>{text}</>
  const names = people.map((p) => p.full_name).sort((a, b) => b.length - a.length)
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g")
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    const who = people.find((p) => p.full_name === m[1])!
    const color = station(who.station_id)?.color ?? "188 57% 48%"
    parts.push(
      <span
        key={m.index}
        className={cn("rounded-md px-1 font-semibold", who.id === me.id && "ring-1 ring-current")}
        style={inverted ? { backgroundColor: "rgb(255 255 255 / 0.22)" } : { color: `hsl(${color})`, backgroundColor: `hsl(${color} / 0.12)` }}
      >
        @{m[1]}
      </span>,
    )
    last = m.index! + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function ChatPoll({ message, inverted }: { message: Message; inverted: boolean }) {
  const { data: poll } = useMessagePoll(message.id)
  const qc = useQueryClient()
  if (!poll) return <p className="text-sm opacity-70">📊 {message.content}</p>
  return <PollView poll={poll} inverted={inverted} onChanged={(next: Poll) => qc.setQueryData(qk.polls(message.id), next)} />
}

export function MessageBubble({
  m, prev, next, isGroup, reply, canPin, readByOther, highlight, onReply, onPin, onDelete, onJump,
}: {
  m: Message
  prev?: Message
  next?: Message
  isGroup: boolean
  reply?: Message | null
  canPin: boolean
  readByOther: boolean
  highlight: boolean
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onJump: (id: string) => void
}) {
  const { me, station } = useApp()
  const member = useMemberMap()
  const { t, fmtDate } = useI18n()
  const [menu, setMenu] = useState(false)
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mine = m.sender_id === me.id
  const sender = member(m.sender_id)
  const color = station(sender?.station_id)?.color ?? "188 57% 48%"
  const firstOfGroup = !prev || prev.sender_id !== m.sender_id || prev.kind === "system" || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
  const lastOfGroup = !next || next.sender_id !== m.sender_id || next.kind === "system"

  if (m.kind === "system") return <p className="my-2 text-center text-xs text-muted-foreground">{m.content}</p>

  const media = m.kind === "image" || m.kind === "gif"
  const longPress = {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setMenu(true) },
    onTouchStart: () => { press.current = setTimeout(() => setMenu(true), 420) },
    onTouchEnd: () => press.current && clearTimeout(press.current),
    onTouchMove: () => press.current && clearTimeout(press.current),
  }

  return (
    <div id={`msg-${m.id}`} className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start", firstOfGroup ? "mt-3" : "mt-0.5")}>
      {!mine && isGroup && <span className="w-8 shrink-0">{lastOfGroup && <MemberAvatar id={m.sender_id} size={32} showOnline={false} />}</span>}
      <div className={cn("relative max-w-[78%]", highlight && "animate-pulse")}>
        <div
          {...longPress}
          className={cn(
            "select-text rounded-3xl",
            media ? "overflow-hidden p-0" : "px-3.5 py-2",
            mine ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg bg-card text-foreground shadow-sm ring-1 ring-border/60",
            m.pending && "opacity-70",
          )}
          style={!mine && isGroup ? { boxShadow: `inset 3px 0 0 hsl(${color})` } : undefined}
        >
          {!mine && isGroup && firstOfGroup && (
            <p className={cn("mb-0.5 text-[12px] font-bold", media && "px-3.5 pt-2")} style={{ color: `hsl(${color})` }}>
              {sender?.full_name ?? t("common.formerMember")}
              <span className="ml-1.5 text-[10px] font-semibold opacity-70">{station(sender?.station_id)?.short}</span>
            </p>
          )}
          {reply && (
            <button onClick={() => onJump(reply.id)} className={cn("mb-1.5 block w-full rounded-xl border-l-[3px] px-2 py-1 text-left text-xs", media && "mx-2 mt-2 w-auto", mine ? "border-primary-foreground/70 bg-primary-foreground/12" : "bg-secondary")} style={!mine ? { borderColor: `hsl(${station(member(reply.sender_id)?.station_id)?.color ?? color})` } : undefined}>
              <p className="font-semibold">{member(reply.sender_id)?.full_name}</p>
              <p className="line-clamp-1 opacity-80">{reply.deleted_at ? t("messages.deleted") : reply.content ?? reply.attachment_name ?? t(`messages.kind.${reply.kind}`)}</p>
            </button>
          )}
          {m.deleted_at ? (
            <p className="text-sm italic opacity-70">{t("messages.deleted")}</p>
          ) : (
            <>
              {media && m.attachment_url && (
                <a href={m.attachment_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.attachment_url} alt="" className="max-h-80 min-w-40 object-cover" loading="lazy" />
                </a>
              )}
              {m.kind === "file" && m.attachment_url && <FileChip path={m.attachment_url} name={m.attachment_name ?? "dosya"} size={m.attachment_size} inverted={mine} />}
              {m.kind === "audio" && m.attachment_url && <AudioMessage src={m.attachment_url} self={mine} />}
              {m.kind === "poll" && <ChatPoll message={m} inverted={mine} />}
              {m.content && m.kind !== "poll" && (
                <p className={cn("whitespace-pre-wrap break-words text-[15px] leading-snug", media && "px-3.5 py-2", m.kind === "file" && "mt-1.5")}>
                  <MentionText text={m.content} mentions={m.mentions} inverted={mine} />
                </p>
              )}
            </>
          )}
          <p className={cn("flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground", media ? "px-3 pb-1.5" : "mt-0.5")}>
            {fmtDate(m.created_at, { hour: "2-digit", minute: "2-digit" })}
            {mine && (m.pending ? <Clock className="size-3" /> : readByOther ? <CheckCheck className="size-3.5" /> : <Check className="size-3" />)}
          </p>
        </div>

        <AnimatePresence>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn("absolute bottom-full z-50 mb-1 w-48 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-foreground shadow-2xl", mine ? "right-0" : "left-0")}
              >
                <MenuItem icon={CornerUpLeft} onClick={() => { setMenu(false); onReply() }}>{t("messages.reply")}</MenuItem>
                {m.content && <MenuItem icon={Copy} onClick={() => { setMenu(false); void navigator.clipboard?.writeText(m.content!) }}>{t("messages.copy")}</MenuItem>}
                {canPin && !m.deleted_at && <MenuItem icon={Pin} onClick={() => { setMenu(false); onPin() }}>{t("messages.pin")}</MenuItem>}
                {mine && !m.deleted_at && <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); onDelete() }}>{t("common.delete")}</MenuItem>}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <button onClick={() => setMenu(true)} className="mb-2 hidden text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" aria-label="menu">⋯</button>
    </div>
  )
}

function MenuItem({ icon: Icon, onClick, children, danger }: { icon: React.ComponentType<{ className?: string }>; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary", danger && "text-destructive")}>
      <Icon className="size-4" /> {children}
    </button>
  )
}
