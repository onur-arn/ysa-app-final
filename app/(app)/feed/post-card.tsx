"use client"

import { Linkified } from "@/components/linkified"
import { ProfileLink } from "@/components/profile/profile-link"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Flag, GraduationCap, Heart, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { useImageViewer } from "@/components/image-viewer"
import { Sheet } from "@/components/ui/sheet"
import { LikersList } from "@/app/(app)/messages/[id]/message-bubble"
import { FeedMentionText } from "@/components/feed-mentions"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { FileChip } from "@/components/file-chip"
import { Logo } from "@/components/logo"
import { PollView } from "@/components/poll-view"
import { StationBadge } from "@/components/station-badge"
import { Card, Pill } from "@/components/ui/misc"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { deletedClass } from "@/lib/members"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isBoard, isIntl } from "@/lib/permissions"
import { ReportSheet, type ReportTarget } from "@/components/report-sheet"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Poll, Post } from "@/lib/types"
import { cn } from "@/lib/utils"

export function PostCard({ post, highlight, onOpenProfile }: { post: Post; highlight?: boolean; onOpenProfile: (id: string) => void }) {
  const { me } = useApp()
  const { t, fmtRelative } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const [showComments, setShowComments] = useState(!!highlight)
  const [comment, setComment] = useState("")
  const [showLikes, setShowLikes] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const canEdit = post.author_id === me.id && post.kind !== "welcome"
  const viewer = useImageViewer()
  const supabase = createClient()
  const author = member(post.author_id)
  const liked = post.post_likes.some((l) => l.user_id === me.id)
  const canDelete = post.author_id === me.id || isBoard(me)
  const canReport = post.author_id !== me.id && post.kind !== "welcome"

  /** optimistic edit of this post in the shared feed cache */
  const patch = (fn: (p: Post) => Post | null) =>
    qc.setQueryData<Post[]>(qk.feed, (old) => old?.flatMap((p) => (p.id === post.id ? (fn(p) ?? []) : [p])))

  async function toggleLike() {
    patch((p) => ({ ...p, post_likes: liked ? p.post_likes.filter((l) => l.user_id !== me.id) : [...p.post_likes, { user_id: me.id }] }))
    const { error } = liked
      ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", me.id)
      : await supabase.from("post_likes").insert({ post_id: post.id, user_id: me.id })
    if (error) void qc.invalidateQueries({ queryKey: qk.feed })
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    const content = comment.trim()
    if (!content) return
    setComment("")
    const temp = { id: `temp-${Date.now()}`, author_id: me.id, content, created_at: new Date().toISOString() }
    patch((p) => ({ ...p, post_comments: [...p.post_comments, temp] }))
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, author_id: me.id, content })
    if (error) toast(t("common.error"), { error: true })
    else dispatchPush()
  }

  async function removeComment(cid: string) {
    patch((p) => ({ ...p, post_comments: p.post_comments.filter((c) => c.id !== cid) }))
    await supabase.from("post_comments").delete().eq("id", cid)
  }

  async function togglePin() {
    setMenu(false)
    patch((p) => ({ ...p, pinned: !p.pinned }))
    const { error } = await supabase.from("posts").update({ pinned: !post.pinned }).eq("id", post.id)
    if (error) toast(t("common.error"), { error: true })
    toast(post.pinned ? t("feed.unpinned") : t("feed.pinnedToast"))
  }

  async function saveEdit() {
    const content = editing?.trim() ?? ""
    if (!content && !post.image_url && !post.file_path && !post.polls) return toast(t("feed.emptyEdit"), { error: true })
    if (content === post.content) return setEditing(null)
    setSavingEdit(true)
    const { error } = await supabase.from("posts").update({ content }).eq("id", post.id)
    setSavingEdit(false)
    if (error) return toast(t("common.error"), { error: true })
    patch((p) => ({ ...p, content, edited_at: new Date().toISOString() }))
    setEditing(null)
    void qc.invalidateQueries({ queryKey: qk.feed })   // mentions are recomputed by the database
  }

  async function remove() {
    setMenu(false)
    if (!confirm(t("feed.confirmDelete"))) return
    patch(() => null)
    await supabase.from("posts").delete().eq("id", post.id)
  }

  const header =
    post.kind === "welcome" ? (
      <Logo size={40} className="shrink-0 rounded-full ring-2 ring-primary/30" />
    ) : (
      <button onClick={() => post.author_id && onOpenProfile(post.author_id)}><MemberAvatar id={post.author_id} size={40} /></button>
    )

  return (
    <Card id={`post-${post.id}`} className={cn("p-0", highlight && "ring-2 ring-primary/40", post.pinned && "border-primary/40", post.kind === "welcome" && "bg-gradient-to-br from-primary/8 to-transparent")}>
      {post.pinned && <div className="flex items-center gap-1.5 rounded-t-2xl bg-primary/10 px-4 py-1.5 text-[11px] font-bold text-primary"><Pin className="size-3" /> {t("feed.pinnedBadge")}</div>}
      <div className="flex items-start gap-3 px-4 pt-4">
        {header}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("truncate text-sm font-semibold text-foreground", deletedClass(author))}>{post.kind === "welcome" ? "YouthStation" : <ProfileLink id={post.author_id}>{author?.full_name ?? t("common.formerMember")}</ProfileLink>}</p>
            {post.kind === "igem" && <Pill tone="violet"><GraduationCap className="size-3" /> {t("feed.igem")}</Pill>}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <StationBadge id={post.station_id ?? author?.station_id} short className="px-2 py-0 text-[10px]" />
            <span>{fmtRelative(post.created_at)}</span>
            {post.edited_at && <span className="italic">· {t("messages.edited")}</span>}
          </div>
        </div>
        {(isIntl(me) || canDelete || canReport) && (
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="menu"><MoreHorizontal className="size-4" /></button>
            <AnimatePresence>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-xl">
                    {isIntl(me) && (
                      <button onClick={togglePin} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary">
                        {post.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {post.pinned ? t("feed.unpin") : t("feed.pin")}
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => { setMenu(false); setEditing(post.content) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"><Pencil className="size-4" /> {t("common.edit")}</button>
                    )}
                    {canReport && (
                      <button onClick={() => { setMenu(false); setReport({ kind: "post", targetId: post.id, label: author?.full_name ?? "" }) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"><Flag className="size-4" /> {t("report.action")}</button>
                    )}
                    {canDelete && (
                      <button onClick={remove} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-secondary"><Trash2 className="size-4" /> {t("common.delete")}</button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {editing !== null ? (
        <div className="flex flex-col gap-2 px-4 pt-3">
          <textarea
            autoFocus
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            rows={Math.min(10, Math.max(3, editing.split("\n").length + 1))}
            className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">{t("common.cancel")}</button>
            <button onClick={saveEdit} disabled={savingEdit} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("common.save")}</button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words px-4 pt-3 text-[15px] leading-relaxed text-foreground">
          {post.kind === "igem" && <span className="mb-1 block text-xs font-semibold text-violet-600">{t("feed.igemIntro")}</span>}
          <FeedMentionText text={post.content} />
        </p>
      )}
      {post.image_url && (
        <button type="button" onClick={() => viewer.open(post.image_url!)} className="mt-3 block w-full" aria-label={t("messages.photo")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image_url} alt="" draggable={false} className="max-h-[520px] w-full object-cover [-webkit-touch-callout:none]" loading="lazy" />
        </button>
      )}
      {post.file_path && <div className="px-4 pt-3"><FileChip path={post.file_path} name={post.file_name ?? "belge.pdf"} size={post.file_size} /></div>}
      {post.polls && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-background/60 p-3">
          <PollView poll={post.polls} onChanged={(next: Poll) => patch((p) => ({ ...p, polls: next }))} />
        </div>
      )}

      {post.kind !== "welcome" && (
        <div className="mt-2 flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
          <span className="flex items-center">
            <button onClick={toggleLike} className={cn("flex items-center rounded-xl py-2 pl-3 pr-2 text-sm font-medium transition-colors hover:bg-secondary", liked ? "text-red-500" : "text-muted-foreground")} aria-label={liked ? t("messages.unlike") : t("messages.like")}>
              <motion.span animate={liked ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.25 }}><Heart className={cn("size-[18px]", liked && "fill-current")} /></motion.span>
            </button>
            {post.post_likes.length > 0 && (
              <button onClick={() => setShowLikes(true)} className={cn("rounded-lg px-1.5 py-2 text-sm font-semibold underline-offset-2 hover:underline", liked ? "text-red-500" : "text-muted-foreground")} aria-label={t("messages.whoLiked")}>
                {post.post_likes.length}
              </button>
            )}
          </span>
          <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary">
            <MessageCircle className="size-[18px]" /> {post.post_comments.length > 0 && post.post_comments.length}
          </button>
        </div>
      )}
      {post.kind === "welcome" && <div className="pb-4" />}

      {showComments && post.kind !== "welcome" && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3">
          {[...post.post_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => {
            const a = member(c.author_id)
            return (
              <div key={c.id} className="flex gap-2.5">
                <ProfileLink id={c.author_id} className="shrink-0"><Avatar name={a?.full_name} photoUrl={a?.photo_url} stationId={a?.station_id} size={28} /></ProfileLink>
                <div className="group min-w-0 flex-1 rounded-2xl bg-secondary/70 px-3 py-2">
                  <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
                    <ProfileLink id={c.author_id} className={deletedClass(a)}>{a?.full_name}</ProfileLink> <span className="font-normal text-muted-foreground">· {fmtRelative(c.created_at)}</span>
                    {(c.author_id === me.id || isBoard(me)) && (
                      <button onClick={() => removeComment(c.id)} className="ml-auto text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100" aria-label={t("common.delete")}><Trash2 className="size-3" /></button>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground"><Linkified text={c.content} /></p>
                </div>
              </div>
            )
          })}
          <form onSubmit={sendComment} className="flex items-center gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("feed.writeComment")} className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={!comment.trim()} className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="send"><Send className="size-4" /></button>
          </form>
        </div>
      )}
      <ReportSheet target={report} onClose={() => setReport(null)} />
      <Sheet open={showLikes} onClose={() => setShowLikes(false)} title={t("messages.whoLiked")}>
        <LikersList ids={post.post_likes.map((l) => l.user_id)} />
      </Sheet>
    </Card>
  )
}
