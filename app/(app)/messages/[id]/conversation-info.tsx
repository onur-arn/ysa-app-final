"use client"

import { Bell, BellOff, Camera, LogOut, Trash2, UserPlus, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { MemberPicker } from "@/components/member-picker"
import { PointsCard } from "@/components/profile/profile-sheet"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Field, Input, Sheet, Toggle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { levelOf } from "@/lib/levels"
import { isAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { ConversationInfo as Conv } from "@/lib/types"
import { compressImage, uploadMedia } from "@/lib/upload"

export function ConversationInfo({ open, onClose, conv, onOpenProfile }: { open: boolean; onClose: () => void; conv: Conv; onOpenProfile: (id: string) => void }) {
  const { me } = useApp()
  const { t } = useI18n()
  const member = useMemberMap()
  const router = useRouter()
  const qc = useQueryClient()
  const supabase = createClient()
  const [adding, setAdding] = useState<string[] | null>(null)
  const [name, setName] = useState(conv.name ?? "")
  const [handover, setHandover] = useState(false)
  const mine = conv.conversation_members.find((m) => m.user_id === me.id)
  const groupAdmin = !!mine?.is_admin || isAdmin(me)
  const other = conv.type === "dm" ? conv.conversation_members.find((m) => m.user_id !== me.id)?.user_id : null
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.conversation(conv.id) })

  async function setMuted(v: boolean) {
    await supabase.from("conversation_members").update({ muted: v }).eq("conversation_id", conv.id).eq("user_id", me.id)
    refresh()
    void qc.invalidateQueries({ queryKey: qk.conversations })
  }

  async function addMembers() {
    if (!adding?.length) return
    const { error } = await supabase.from("conversation_members").insert(adding.map((user_id) => ({ conversation_id: conv.id, user_id })))
    if (error) return toast(t("common.error"), { error: true })
    await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: me.id, kind: "system", content: t("messages.added", { name: me.full_name, who: adding.map((id) => member(id)?.full_name).join(", ") }) })
    setAdding(null)
    refresh()
  }

  async function kick(userId: string) {
    await supabase.from("conversation_members").delete().eq("conversation_id", conv.id).eq("user_id", userId)
    await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: me.id, kind: "system", content: t("messages.removed", { name: me.full_name, who: member(userId)?.full_name ?? "" }) })
    refresh()
  }

  async function makeAdmin(userId: string, value: boolean) {
    const { error } = await supabase.from("conversation_members").update({ is_admin: value }).eq("conversation_id", conv.id).eq("user_id", userId)
    if (error) return toast(t("common.error"), { error: true })
    if (value) await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: me.id, kind: "system", content: t("messages.madeAdmin", { name: me.full_name, who: member(userId)?.full_name ?? "" }) })
    refresh()
  }

  // The last admin must hand the group over before leaving.
  const others = conv.conversation_members.filter((m) => m.user_id !== me.id)
  const mustHandOver = !!mine?.is_admin && others.length > 0 && !others.some((m) => m.is_admin)

  async function leave(successor?: string) {
    if (mustHandOver && !successor) return setHandover(true)
    if (!successor && !confirm(t("messages.confirmLeave"))) return
    if (successor) await makeAdmin(successor, true)
    await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: me.id, kind: "system", content: t("messages.left", { name: me.full_name }) })
    await supabase.from("conversation_members").delete().eq("conversation_id", conv.id).eq("user_id", me.id)
    router.push("/messages")
  }

  async function remove() {
    if (!confirm(t("messages.confirmDeleteGroup"))) return
    const { error } = await supabase.from("conversations").delete().eq("id", conv.id)
    if (error) return toast(t("common.error"), { error: true })
    router.push("/messages")
  }

  async function save(patch: { name?: string; avatar_url?: string }) {
    const { error } = await supabase.from("conversations").update(patch).eq("id", conv.id)
    if (error) return toast(t("common.error"), { error: true })
    toast(t("common.saved"))
    refresh()
  }

  async function changeAvatar(f: File | undefined) {
    if (!f) return
    await save({ avatar_url: await uploadMedia(await compressImage(f, 512), me.id, "groups") })
  }

  return (
    <Sheet open={open} onClose={onClose} title={conv.type === "dm" ? member(other)?.full_name ?? "" : conv.name ?? t("messages.group")}>
      <div className="flex flex-col gap-4">
        {conv.type === "group" && (
          <div className="flex flex-col items-center gap-2">
            <label className={groupAdmin ? "relative cursor-pointer" : "relative"}>
              {conv.avatar_url ? <Avatar name={conv.name} photoUrl={conv.avatar_url} size={84} /> : <span className="flex size-[84px] items-center justify-center rounded-full bg-primary/12 font-heading text-2xl font-bold text-primary">{(conv.name ?? "G").slice(0, 2).toUpperCase()}</span>}
              {groupAdmin && <span className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card"><Camera className="size-3.5" /></span>}
              {groupAdmin && <input type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />}
            </label>
          </div>
        )}
        {other && <PointsCard userId={other} />}
        <Toggle checked={!!mine?.muted} onChange={setMuted} label={<span className="flex items-center gap-2">{mine?.muted ? <BellOff className="size-4" /> : <Bell className="size-4" />} {t("messages.mute")}</span>} />
        {conv.type === "group" && (
          <>
            {groupAdmin && (
              <Field label={t("messages.groupName")}>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Button variant="secondary" onClick={() => name.trim() && save({ name: name.trim() })}>{t("common.save")}</Button>
                </div>
              </Field>
            )}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("messages.membersCount", { n: conv.conversation_members.length })}</h4>
                {groupAdmin && adding === null && (
                  <button onClick={() => setAdding([])} className="flex items-center gap-1 text-xs font-semibold text-primary"><UserPlus className="size-3.5" /> {t("common.add")}</button>
                )}
              </div>
              {adding !== null ? (
                <div className="flex flex-col gap-2">
                  <MemberPicker value={adding} onChange={setAdding} exclude={conv.conversation_members.map((m) => m.user_id)} />
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setAdding(null)}>{t("common.cancel")}</Button>
                    <Button className="flex-1" onClick={addMembers} disabled={!adding.length}>{t("common.add")}</Button>
                  </div>
                </div>
              ) : (
                [...conv.conversation_members]
                  .sort((a, b) => (member(b.user_id)?.points ?? 0) - (member(a.user_id)?.points ?? 0))
                  .map((m) => {
                    const p = member(m.user_id)
                    const lvl = levelOf(p?.points ?? 0)
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                        <button onClick={() => onOpenProfile(m.user_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <MemberAvatar id={m.user_id} size={38} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{p?.full_name ?? t("common.formerMember")}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <StationBadge id={p?.station_id} short className="px-1.5 py-0 text-[10px]" />
                              {lvl.current.emoji} {p?.points ?? 0}
                              {m.is_admin && <span className="font-semibold text-primary">· {t("messages.admin")}</span>}
                            </span>
                          </span>
                        </button>
                        {groupAdmin && m.user_id !== me.id && (
                          <>
                            <button onClick={() => makeAdmin(m.user_id, !m.is_admin)} className={m.is_admin ? "rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary" : "rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"}>
                              {m.is_admin ? t("messages.removeAdmin") : t("messages.makeAdmin")}
                            </button>
                            <button onClick={() => kick(m.user_id)} className="text-muted-foreground hover:text-destructive" aria-label="remove"><X className="size-4" /></button>
                          </>
                        )}
                      </div>
                    )
                  })
              )}
            </div>
            <Button variant="outline" onClick={() => leave()} className="text-destructive"><LogOut className="size-4" /> {t("messages.leave")}</Button>
            {groupAdmin && <Button variant="ghost" onClick={remove} className="text-destructive"><Trash2 className="size-4" /> {t("messages.deleteGroup")}</Button>}
          </>
        )}
      </div>
      <Sheet open={handover} onClose={() => setHandover(false)} title={t("messages.pickAdmin")}>
        <p className="mb-3 text-sm text-muted-foreground">{t("messages.pickAdminText")}</p>
        <div className="flex flex-col gap-1">
          {others.map((m) => (
            <button key={m.user_id} onClick={() => { setHandover(false); void leave(m.user_id) }} className="flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary">
              <MemberAvatar id={m.user_id} size={38} />
              <span className="flex-1 truncate text-sm font-medium text-foreground">{member(m.user_id)?.full_name}</span>
              <span className="text-xs font-semibold text-primary">{t("messages.makeAdmin")}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </Sheet>
  )
}
