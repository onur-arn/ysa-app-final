"use client"

import { AtSign, BellOff, Camera, MessageCirclePlus, MessagesSquare, Search, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { MemberPicker } from "@/components/member-picker"
import { Button } from "@/components/ui/button"
import { EmptyState, Segmented } from "@/components/ui/misc"
import { Field, Input, Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useConversations, useMemberMap } from "@/lib/data/hooks"
import { deletedClass } from "@/lib/members"
import { useI18n } from "@/lib/i18n/context"
import { useHub } from "@/lib/realtime/hub"
import { createClient } from "@/lib/supabase/client"
import type { ConversationRow } from "@/lib/types"
import { compressImage, uploadMedia } from "@/lib/upload"
import { cn } from "@/lib/utils"

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="size-[50px] animate-pulse rounded-full bg-secondary" />
          <div className="flex flex-1 flex-col gap-2"><div className="h-3 w-1/2 animate-pulse rounded bg-secondary" /><div className="h-3 w-3/4 animate-pulse rounded bg-secondary" /></div>
        </div>
      ))}
    </div>
  )
}

export function ConversationList() {
  const { t, fmtRelative } = useI18n()
  const { me } = useApp()
  const member = useMemberMap()
  const router = useRouter()
  const { typingIn } = useHub()
  const { data: rows, isPending } = useConversations()
  const [q, setQ] = useState("")
  const [creating, setCreating] = useState(false)

  const titleOf = (c: ConversationRow) => (c.type === "dm" ? member(c.other_id)?.full_name ?? t("common.formerMember") : c.name ?? t("messages.group"))
  const list = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr")
    return (rows ?? []).filter((c) => !s || titleOf(c).toLocaleLowerCase("tr").includes(s))
  }, [rows, q]) // eslint-disable-line react-hooks/exhaustive-deps

  function preview(c: ConversationRow) {
    const typers = typingIn(c.id)
    if (typers.length) return <span className="font-medium text-primary">{t("messages.typing")}</span>
    if (!c.last_kind) return t("messages.noMessages")
    const who = c.last_sender === me.id ? `${t("messages.you")}: ` : c.type === "group" && c.last_sender ? `${member(c.last_sender)?.first_name ?? ""}: ` : ""
    const body =
      c.last_kind === "image" ? `📷 ${t("messages.photo")}` : c.last_kind === "file" ? `📎 ${t("messages.file")}` : c.last_kind === "audio" ? `🎤 ${t("messages.voice")}`
        : c.last_kind === "gif" ? "GIF" : c.last_kind === "poll" ? `📊 ${c.last_content ?? ""}` : c.last_content ?? ""
    return c.last_kind === "system" ? body : who + body
  }


  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.search")} className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <button onClick={() => setCreating(true)} className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 active:scale-95" aria-label={t("messages.new")}>
          <MessageCirclePlus className="size-5" />
        </button>
      </div>

      {isPending && !rows ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={t("messages.empty")} text={t("messages.emptyText")} action={<Button onClick={() => setCreating(true)}>{t("messages.new")}</Button>} />
      ) : (
        <div className="flex flex-col">
          {list.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} prefetch className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-secondary/60 active:bg-secondary">
              {c.type === "dm" ? (
                <MemberAvatar id={c.other_id} size={50} />
              ) : c.avatar_url ? (
                <Avatar name={c.name} photoUrl={c.avatar_url} size={50} />
              ) : (
                <span className="flex size-[50px] shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Users className="size-6" /></span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("flex-1 truncate text-[15px] text-foreground", c.unread ? "font-bold" : "font-semibold", c.type === "dm" && deletedClass(member(c.other_id)))}>{titleOf(c)}</p>
                  <span className={cn("shrink-0 text-[11px]", c.unread ? "font-semibold text-primary" : "text-muted-foreground")}>{fmtRelative(c.last_message_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={cn("flex-1 truncate text-sm", c.unread ? "font-medium text-foreground" : "text-muted-foreground")}>{preview(c)}</p>
                  {c.muted && <BellOff className="size-3.5 shrink-0 text-muted-foreground" />}
                  {c.mentioned && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white"><AtSign className="size-3" /></span>}
                  {c.unread > 0 && <span className={cn("flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5", c.muted ? "bg-muted-foreground/30 text-foreground" : "bg-primary text-primary-foreground")}>{c.unread}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewConversation open={creating} onClose={() => setCreating(false)} onOpen={(id) => router.push(`/messages/${id}`)} />
    </div>
  )
}

function NewConversation({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const { t } = useI18n()
  const { me } = useApp()
  const [mode, setMode] = useState<"dm" | "group">("dm")
  const [ids, setIds] = useState<string[]>([])
  const [name, setName] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  async function create() {
    const supabase = createClient()
    setLoading(true)
    try {
      if (mode === "dm") {
        const { data, error } = await supabase.rpc("open_dm", { other: ids[0] })
        if (error) throw error
        onOpen(data as string)
      } else {
        const avatar_url = photo ? await uploadMedia(await compressImage(photo, 512), me.id, "groups") : null
        const { data: conv, error } = await supabase.from("conversations").insert({ type: "group", name: name.trim(), avatar_url, created_by: me.id }).select("id").single()
        if (error) throw error
        const { error: e2 } = await supabase.from("conversation_members").insert([{ conversation_id: conv.id, user_id: me.id, is_admin: true }, ...ids.map((user_id) => ({ conversation_id: conv.id, user_id, is_admin: false }))])
        if (e2) throw e2
        await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: me.id, kind: "system", content: t("messages.groupCreated", { name: me.full_name }) })
        onOpen(conv.id)
      }
      onClose()
    } catch {
      toast(t("common.error"), { error: true })
    }
    setLoading(false)
  }

  const valid = mode === "dm" ? ids.length === 1 : ids.length >= 1 && name.trim().length > 0
  return (
    <Sheet open={open} onClose={onClose} title={t("messages.new")} footer={<Button className="w-full" size="lg" disabled={!valid} loading={loading} onClick={create}>{mode === "dm" ? t("messages.startChat") : t("messages.createGroup")}</Button>}>
      <div className="flex flex-col gap-4">
        <Segmented value={mode} onChange={(m) => { setMode(m); setIds([]) }} layoutId="new-conv" options={[{ id: "dm", label: t("messages.private") }, { id: "group", label: t("messages.group") }]} />
        {mode === "group" && (
          <div className="flex items-end gap-3">
            <label className="flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={URL.createObjectURL(photo)} alt="" className="size-full object-cover" /> : <Camera className="size-5" />}
              <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
            <Field label={t("messages.groupName")} className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          </div>
        )}
        <MemberPicker value={ids} onChange={setIds} multiple={mode === "group"} exclude={[me.id]} />
      </div>
    </Sheet>
  )
}
