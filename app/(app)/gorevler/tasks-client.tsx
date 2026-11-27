"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ListChecks, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Chips, EmptyState, Fab, Segmented } from "@/components/ui/misc"
import { useApp } from "@/components/providers/app-context"
import { TASK_STATUSES } from "@/lib/constants"
import { useTasks } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isGuest, isIntl } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { Task, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TaskCard } from "./task-card"
import { TaskDetail } from "./task-detail"
import { TaskForm } from "./task-form"
import { NotesClient } from "./notes-client"

const COUNTER_COLORS: Record<TaskStatus, string> = { todo: "oklch(0.6 0.02 250)", in_progress: "oklch(0.68 0.078 205)", done: "oklch(0.7 0.13 150)" }
const NEXT: Record<TaskStatus, TaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" }
const PRIO = { urgent: 0, normal: 1, low: 2 }

export function TasksClient() {
  const { t } = useI18n()
  const { me, stations } = useApp()
  const qc = useQueryClient()
  const router = useRouter()
  const params = useSearchParams()
  const { data: tasks = [], isPending } = useTasks()
  const intl = isIntl(me)
  const [status, setStatus] = useState<TaskStatus | null>(null)
  const [scope, setScope] = useState<string>("all")
  const [openId, setOpenId] = useState<string | null>(params.get("open"))
  const [form, setForm] = useState<{ open: boolean; task?: Task }>({ open: false })

  const [tab, setTab] = useState<"tasks" | "notes">(params.get("tab") === "notes" ? "notes" : "tasks")
  useEffect(() => setOpenId(params.get("open")), [params])
  useEffect(() => { if (params.get("tab") === "notes") setTab("notes") }, [params])

  const scoped = useMemo(
    // RLS already limits members to their own station; Uluslararası can narrow by station.
    () => tasks.filter((x) => scope === "all" || x.station_id === scope),
    [tasks, scope],
  )
  const STATUS_RANK = { todo: 0, in_progress: 1, done: 2 }
  const list = scoped.filter((x) => !status || x.status === status).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || PRIO[a.priority] - PRIO[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
  const open = tasks.find((x) => x.id === openId) ?? null

  async function setTaskStatus(task: Task, next: TaskStatus) {
    qc.setQueryData<Task[]>(qk.tasks, (old) => old?.map((x) => (x.id === task.id ? { ...x, status: next } : x)))
    const { error } = await createClient().from("tasks").update({ status: next }).eq("id", task.id)
    if (error) void qc.invalidateQueries({ queryKey: qk.tasks })
  }

  function close() {
    setOpenId(null)
    if (params.get("open")) router.replace("/gorevler")
  }

  const tabs = (
    <Segmented layoutId="tasks-tab" value={tab} onChange={setTab} options={[{ id: "tasks", label: t("nav.tasks") }, { id: "notes", label: t("notes.title") }]} />
  )
  if (tab === "notes") {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4">
        {tabs}
        <NotesClient />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      {tabs}
      {intl && (
        <Chips value={scope} onChange={setScope} options={[{ id: "all", label: t("common.all") }, ...stations.map((s) => ({ id: s.id, label: s.city, color: s.color }))]} />
      )}
      {/* v1 counters: tap to filter, tap again to see everything */}
      <div className="grid grid-cols-3 gap-2">
        {TASK_STATUSES.map((st) => {
          const active = status === st.id
          const color = COUNTER_COLORS[st.id]
          return (
            <button
              key={st.id}
              onClick={() => setStatus(active ? null : st.id)}
              className={cn("flex flex-col items-center rounded-2xl border p-3 transition-all", active ? "border-transparent text-white shadow-md" : "border-border bg-card text-foreground")}
              style={active ? { backgroundColor: color } : undefined}
            >
              <span className="font-heading text-2xl font-bold">{scoped.filter((x) => x.status === st.id).length}</span>
              <span className={cn("mt-0.5 text-center text-[11px] font-medium", active ? "text-white/90" : "text-muted-foreground")}>{t(`tasks.status.${st.id}`)}</span>
            </button>
          )
        })}
      </div>
      {isPending && !tasks.length ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("tasks.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((task) => <TaskCard key={task.id} task={task} showStation={intl} onClick={() => setOpenId(task.id)} onCycle={() => setTaskStatus(task, NEXT[task.status])} />)}
        </div>
      )}
      {!isGuest(me) && <Fab icon={Plus} label={t("tasks.newTask")} onClick={() => setForm({ open: true })} />}
      <TaskDetail task={open} onClose={close} onEdit={(task) => { close(); setForm({ open: true, task }) }} onStatus={setTaskStatus} />
      <TaskForm open={form.open} task={form.task} onClose={() => setForm({ open: false })} />
    </div>
  )
}
