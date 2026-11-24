"use client"

import { ProfileLink } from "@/components/profile/profile-link"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Pencil, Send, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { Avatar, MemberAvatar } from "@/components/avatar"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants"
import { useMemberMap, useTaskComments } from "@/lib/data/hooks"
import { deletedClass } from "@/lib/members"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isBoard } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { Task, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isOverdue } from "./task-card"

export function TaskDetail({ task, onClose, onEdit, onStatus }: { task: Task | null; onClose: () => void; onEdit: (t: Task) => void; onStatus: (t: Task, s: TaskStatus) => void }) {
  const { me } = useApp()
  const { t, fmtDate, fmtRelative } = useI18n()
  const member = useMemberMap()
  const qc = useQueryClient()
  const { data: comments = [] } = useTaskComments(task?.id ?? null)
  const [text, setText] = useState("")
  if (!task) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const canDelete = task.created_by === me.id || isBoard(me)
  const prio = TASK_PRIORITIES.find((p) => p.id === task.priority)!

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText("")
    const { error } = await createClient().from("task_comments").insert({ task_id: task!.id, author_id: me.id, content })
    if (error) return toast(t("common.error"), { error: true })
    void qc.invalidateQueries({ queryKey: qk.taskComments(task!.id) })
  }

  async function remove() {
    if (!confirm(t("tasks.confirmDelete"))) return
    qc.setQueryData<Task[]>(qk.tasks, (old) => old?.filter((x) => x.id !== task!.id))
    onClose()
    await createClient().from("tasks").delete().eq("id", task!.id)
  }

  return (
    <Sheet open onClose={onClose} title={task.title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={prio.tone}>{t(`tasks.priority.${task.priority}`)}</Pill>
          <StationBadge id={task.station_id} className="py-0.5 text-[11px]" />
          {task.due_date && <Pill tone={isOverdue(task) ? "red" : "neutral"}><CalendarClock className="size-3" /> {fmtDate(task.due_date, { day: "numeric", month: "long" })}</Pill>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {TASK_STATUSES.map((s) => (
            <button key={s.id} onClick={() => onStatus(task, s.id)} className={cn("rounded-xl border px-1 py-2 text-xs font-semibold transition-colors", task.status === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
              {t(`tasks.status.${s.id}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-secondary/60 p-3 text-xs">
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">{t("tasks.assignee")}</p>
            {task.assign_all ? <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Users className="size-4 text-primary" /> {t("tasks.wholeTeam")}</p>
              : task.assignee_ids?.length ? (
                <div className="flex flex-col gap-1.5">
                  {task.assignee_ids.map((id) => (
                    <ProfileLink key={id} id={id} className="flex items-center gap-2 text-sm font-medium text-foreground"><MemberAvatar id={id} size={24} showOnline={false} /> <span className={deletedClass(member(id))}>{member(id)?.full_name}</span></ProfileLink>
                  ))}
                </div>
              ) : <p className="text-sm font-medium text-foreground">{t("tasks.unassigned")}</p>}
          </div>
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">{t("tasks.assignedBy")}</p>
            <ProfileLink id={task.created_by} className="flex items-center gap-2 text-sm font-medium text-foreground"><MemberAvatar id={task.created_by} size={24} showOnline={false} /> <span className={deletedClass(member(task.created_by))}>{member(task.created_by)?.full_name ?? "—"}</span></ProfileLink>
          </div>
        </div>
        {task.description && <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("tasks.comments")}</h4>
          <div className="flex flex-col gap-2.5">
            {comments.map((c) => {
              const a = member(c.author_id)
              return (
                <div key={c.id} className="flex gap-2.5">
                  <ProfileLink id={c.author_id} className="shrink-0"><Avatar name={a?.full_name} photoUrl={a?.photo_url} stationId={a?.station_id} size={28} /></ProfileLink>
                  <div className="min-w-0 flex-1 rounded-2xl bg-secondary/70 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground"><ProfileLink id={c.author_id} className={deletedClass(a)}>{a?.full_name}</ProfileLink> <span className="font-normal text-muted-foreground">· {fmtRelative(c.created_at)}</span></p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <form onSubmit={send} className="mt-2 flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("tasks.addComment")} className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={!text.trim()} className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="send"><Send className="size-4" /></button>
          </form>
        </div>
        <div className="flex gap-2 border-t border-border pt-3">
          <Button variant="secondary" size="sm" onClick={() => onEdit(task)}><Pencil className="size-4" /> {t("common.edit")}</Button>
          {canDelete && <Button variant="ghost" size="sm" onClick={remove} className="text-destructive"><Trash2 className="size-4" /> {t("tasks.delete")}</Button>}
        </div>
      </div>
    </Sheet>
  )
}
