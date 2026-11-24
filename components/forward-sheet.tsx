"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Check, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useConversations, useMemberMap } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { ConversationRow, Message } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Kinds that can be forwarded as-is (polls belong to their conversation). */
export const FORWARDABLE = new Set(["text", "image", "gif", "audio", "file"])

/**
 * Forward a message to one or several conversations. The copy is sent by the current user.
 * Private files (bucket "files", readable by the conversation's members only) are copied
 * into each target conversation so its members can open them.
 */
export function ForwardSheet({ message, onClose }: { message: Message | null; onClose: () => void }) {
  const { me } = useApp()
  const { t } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const { data: rows = [] } = useConversations()
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  const titleOf = (c: ConversationRow) => (c.type === "dm" ? member(c.other_id)?.full_name ?? t("common.formerMember") : c.name ?? t("messages.group"))
  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr")
    return rows.filter((c) => !s || titleOf(c).toLocaleLowerCase("tr").includes(s))
  }, [rows, q]) // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    setPicked([])
    setQ("")
    onClose()
  }

  async function send() {
    if (!message || !picked.length) return
    setSending(true)
    const sb = createClient()
    let failed = 0
    for (const cid of picked) {
      try {
        let attachment = message.attachment_url
        if (message.kind === "file" && attachment) {
          // copy the private file into the target conversation's folder
          const dest = `${cid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${attachment.split("/").pop()}`
          const { error } = await sb.storage.from("files").copy(attachment, dest)
          if (error) throw error
          attachment = dest
        }
        const row = {
          conversation_id: cid,
          sender_id: me.id,
          kind: message.kind,
          content: message.content,
          mentions: [],
          attachment_url: attachment,
          attachment_name: message.attachment_name,
          attachment_size: message.attachment_size,
        }
        let { error } = await sb.from("messages").insert({ ...row, forwarded: true })
        // Base not yet migrated (no "forwarded" column): forward without the label.
        if (error && /forwarded/.test(error.message)) ({ error } = await sb.from("messages").insert(row))
        if (error) throw error
        void qc.invalidateQueries({ queryKey: qk.messages(cid) })
      } catch {
        failed++
      }
    }
    setSending(false)
    void qc.invalidateQueries({ queryKey: qk.conversations })
    dispatchPush()
    if (failed) toast(t("messages.forwardFailed"), { error: true })
    else toast(t("messages.forwarded", { n: picked.length }))
    close()
  }

  return (
    <Sheet
      open={!!message}
      onClose={close}
      title={t("messages.forwardTo")}
      footer={
        <button
          onClick={send}
          disabled={!picked.length || sending}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {sending ? "…" : picked.length > 1 ? t("messages.forwardN", { n: picked.length }) : t("messages.forward")}
        </button>
      }
    >
      <label className="mb-3 flex h-11 items-center gap-2 rounded-2xl bg-secondary px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.searchConversation")} className="flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="flex flex-col">
        {list.map((c) => {
          const on = picked.includes(c.id)
          return (
            <button
              key={c.id}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-secondary"
            >
              {c.type === "dm" ? (
                <MemberAvatar id={c.other_id} size={42} showOnline={false} />
              ) : c.avatar_url ? (
                <Avatar name={c.name} photoUrl={c.avatar_url} size={42} />
              ) : (
                <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Users className="size-5" /></span>
              )}
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">{titleOf(c)}</span>
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
