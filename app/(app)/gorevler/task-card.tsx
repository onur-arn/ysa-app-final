"use client"

import { CalendarClock, MessageSquare, Users } from "lucide-react"
import { MemberAvatar } from "@/components/avatar"
import { StationBadge } from "@/components/station-badge"
import { Card, Pill } from "@/components/ui/misc"
import { TASK_PRIORITIES } from "@/lib/constants"
import { useI18n } from "@/lib/i18n/context"
import type { Task } from "@/lib/types"
import { cn } from "@/lib/utils"

export const isOverdue = (task: Pick<Task, "due_date" | "status">) => !!task.due_date && task.status !== "done" && new Date(`${task.due_date}T23:59:59`) < new Date()

export function TaskCard({ task, showStation, onClick, onCycle }: { task: Task; showStation: boolean; onClick: () => void; onCycle: () => void }) {
  const { t, fmtDate } = useI18n()
  const prio = TASK_PRIORITIES.find((p) => p.id === task.priority)!
  const overdue = isOverdue(task)
  const comments = task.task_comments[0]?.count ?? 0
  return (
    <Card className={cn("flex items-start gap-3 p-3.5 transition-colors hover:border-primary/40", task.status === "done" && "opacity-70")}>
      <button
        onClick={onCycle}
        aria-label={t("tasks.changeStatus")}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs transition-colors",
          task.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : task.status === "in_progress" ? "border-sky-500 bg-sky-500/15" : "border-muted-foreground/40",
        )}
      >
        {task.status === "done" && "✓"}
        {task.status === "in_progress" && <span className="size-2 rounded-full bg-sky-500" />}
      </button>
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-start gap-2">
          <p className={cn("flex-1 text-sm font-semibold text-foreground", task.status === "done" && "line-through")}>{task.title}</p>
          {task.priority !== "normal" && <Pill tone={prio.tone}>{t(`tasks.priority.${task.priority}`)}</Pill>}
        </div>
        {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {showStation && <StationBadge id={task.station_id} short className="px-2 py-0 text-[10px]" />}
          {task.due_date && (
            <span className={cn("flex items-center gap-1", overdue && "font-semibold text-red-500")}>
              <CalendarClock className="size-3.5" /> {overdue ? `${t("tasks.overdue")} · ` : ""}{fmtDate(task.due_date, { day: "numeric", month: "short" })}
            </span>
          )}
          {comments > 0 && <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {comments}</span>}
          <span className="ml-auto">
            {task.assign_all ? <span className="flex items-center gap-1 font-semibold text-primary"><Users className="size-3.5" /> {t("tasks.wholeTeam")}</span>
              : task.assignee_id ? <MemberAvatar id={task.assignee_id} size={22} showOnline={false} /> : <span className="italic">{t("tasks.unassigned")}</span>}
          </span>
        </div>
      </button>
    </Card>
  )
}
