"use client"

import { Star } from "lucide-react"
import { MemberAvatar } from "@/components/avatar"
import { EmptyState } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { useConversations, useMemberMap, useStars } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import type { Message } from "@/lib/types"

/**
 * ⭐ Yıldızlı mesajlar: the member's important messages, every conversation or just one.
 * Tapping one opens it in its conversation.
 */
export function StarredSheet({ open, onClose, convId, onPick }: { open: boolean; onClose: () => void; convId?: string; onPick: (m: Message) => void }) {
  const { t, fmtDate } = useI18n()
  const member = useMemberMap()
  const { data: stars = [], isPending } = useStars()
  const { data: convs = [] } = useConversations()
  const list = stars.filter((s) => s.messages && !s.messages.deleted_at && (!convId || s.messages.conversation_id === convId))
  const convName = (id: string) => {
    const c = convs.find((x) => x.id === id)
    if (!c) return ""
    return c.type === "dm" ? member(c.other_id)?.full_name ?? "" : c.name ?? t("messages.group")
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("messages.starredTitle")}>
      {isPending && !stars.length ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Star} title={t("messages.starredEmpty")} text={t("messages.starredHelp")} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(({ messages: m }) => (
            <button key={m!.id} onClick={() => onPick(m!)} className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3 text-left active:bg-secondary">
              <MemberAvatar id={m!.sender_id} size={34} showOnline={false} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs">
                  <b className="truncate text-foreground">{member(m!.sender_id)?.full_name ?? t("common.formerMember")}</b>
                  {!convId && <span className="truncate text-muted-foreground">› {convName(m!.conversation_id)}</span>}
                  <span className="ml-auto shrink-0 text-muted-foreground">{fmtDate(m!.created_at, { day: "numeric", month: "short" })}</span>
                </span>
                <span className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-foreground">
                  {m!.kind === "text" ? m!.content : m!.kind === "image" ? `📷 ${t("messages.photo")}` : m!.kind === "file" ? `📎 ${m!.attachment_name ?? t("messages.file")}` : m!.kind === "audio" ? `🎤 ${t("messages.voice")}` : m!.kind === "poll" ? `📊 ${m!.content ?? ""}` : m!.kind === "gif" ? "GIF" : m!.content}
                </span>
              </span>
              <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-400" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
