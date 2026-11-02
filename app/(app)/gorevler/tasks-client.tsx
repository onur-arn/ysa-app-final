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
import { isIntl } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import type { Task, TaskStatus } from "@/lib/types"
import { TaskCard } from "./task-card"
import { TaskDetail } from "./task-detail"
import { TaskForm } from "./task-form"

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
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [scope, setScope] = useState<string>("all")
  const [openId, setOpenId] = useState<string | null>(params.get("open"))
  const [form, setForm] = useState<{ open: boolean; task?: Task }>({ open: false })

  useEffect(() => setOpenId(params.get("open")), [params])

  const scoped = useMemo(
    () => tasks.filter((x) => scope === "all" ? true : scope === "mine" ? x.assignee_id === me.id || (x.assign_all && x.station_id === me.station_id) : x.station_id === scope),
    [tasks, scope, me.id, me.station_id],
  )
  const list = scoped.filter((x) => x.status === status).sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
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

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <Chips
        value={scope}
        onChange={setScope}
        options={[
          { id: "all", label: t("common.all") },
          { id: "mine", label: t("tasks.mine") },
          ...(intl ? stations.map((s) => ({ id: s.id, label: s.city, color: s.color })) : []),
        ]}
      />
      <Segmented value={status} onChange={setStatus} layoutId="task-status" options={TASK_STATUSES.map((s) => ({ id: s.id, label: t(`tasks.status.${s.id}`), count: scoped.filter((x) => x.status === s.id).length }))} />
      {isPending && !tasks.length ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("tasks.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((task) => <TaskCard key={task.id} task={task} showStation={intl} onClick={() => setOpenId(task.id)} onCycle={() => setTaskStatus(task, NEXT[task.status])} />)}
        </div>
      )}
      <Fab icon={Plus} label={t("tasks.newTask")} onClick={() => setForm({ open: true })} />
      <TaskDetail task={open} onClose={close} onEdit={(task) => { close(); setForm({ open: true, task }) }} onStatus={setTaskStatus} />
      <TaskForm open={form.open} task={form.task} onClose={() => setForm({ open: false })} />
    </div>
  )
}
