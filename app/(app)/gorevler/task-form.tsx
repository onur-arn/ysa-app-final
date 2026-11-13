"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { MemberPicker } from "@/components/member-picker"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Sheet, Textarea } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { TASK_PRIORITIES } from "@/lib/constants"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isIntl } from "@/lib/permissions"
import { dispatchPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Task, TaskPriority } from "@/lib/types"

export function TaskForm({ open, task, onClose }: { open: boolean; task?: Task; onClose: () => void }) {
  const { me, stations } = useApp()
  const { t } = useI18n()
  const qc = useQueryClient()
  const intl = isIntl(me)
  const [f, setF] = useState({ title: "", description: "", priority: "normal" as TaskPriority, station_id: "", due_date: "", assignee: [] as string[], all: false })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(task
      ? { title: task.title, description: task.description ?? "", priority: task.priority, station_id: task.station_id, due_date: task.due_date ?? "", assignee: task.assignee_ids ?? [], all: task.assign_all }
      : { title: "", description: "", priority: "normal", station_id: me.station_id === "intl" ? "paris" : me.station_id ?? "paris", due_date: "", assignee: [], all: false })
  }, [open, task, me.station_id])

  async function submit() {
    if (!f.title.trim()) return toast(t("common.requiredFields"), { error: true })
    setLoading(true)
    const row = {
      title: f.title.trim(), description: f.description.trim() || null, priority: f.priority, due_date: f.due_date || null,
      station_id: intl ? f.station_id : me.station_id!, assignee_ids: f.all ? [] : f.assignee, assignee_id: f.all ? null : f.assignee[0] ?? null, assign_all: f.all,
    }
    const supabase = createClient()
    const { error } = task ? await supabase.from("tasks").update(row).eq("id", task.id) : await supabase.from("tasks").insert({ ...row, created_by: me.id })
    setLoading(false)
    if (error) return toast(t("common.error"), { error: true })
    void qc.invalidateQueries({ queryKey: qk.tasks })
    dispatchPush()
    toast(task ? t("common.saved") : t("tasks.created"))
    onClose()
  }

  const target = intl ? f.station_id : me.station_id
  return (
    <Sheet open={open} onClose={onClose} title={task ? t("tasks.edit") : t("tasks.newTask")} footer={<Button className="w-full" size="lg" onClick={submit} loading={loading}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <Field label={t("common.title")}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("tasks.titlePlaceholder")} /></Field>
        <Field label={t("tasks.description")}><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t("tasks.descPlaceholder")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tasks.priorityLabel")}>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TaskPriority })}>
              {TASK_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{t(`tasks.priority.${p.id}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("tasks.dueDate")}><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} className="px-3" /></Field>
        </div>
        {intl && (
          <Field label={t("profile.station")}>
            <Select value={f.station_id} onChange={(e) => setF({ ...f, station_id: e.target.value, assignee: [], all: false })}>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={t("tasks.assignee")}>
          <MemberPicker
            value={f.all ? [] : f.assignee}
            onChange={(ids) => setF({ ...f, assignee: ids, all: false })}
            stationFilter={target}
            allOption={{ selected: f.all, onSelect: () => setF({ ...f, all: !f.all, assignee: [] }) }}
          />
        </Field>
      </div>
    </Sheet>
  )
}
