"use client"

import { Flag } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { Field, Sheet, Textarea } from "@/components/ui/sheet"
import { useI18n } from "@/lib/i18n/context"
import { reportContent } from "@/lib/report"
import type { Report } from "@/lib/types"

export type ReportTarget = { kind: Report["kind"]; targetId: string; conversationId?: string | null; label: string }

/** Shared "Şikayet et" sheet used by posts, messages and profiles. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { t } = useI18n()
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!target) return
    setLoading(true)
    const ok = await reportContent(target.kind, target.targetId, target.conversationId ?? null, reason)
    setLoading(false)
    if (ok) {
      toast(t("report.sent"))
      setReason("")
      onClose()
    }
  }

  return (
    <Sheet
      open={!!target}
      onClose={() => { setReason(""); onClose() }}
      title={t("report.title")}
      footer={<Button className="w-full" size="lg" onClick={submit} loading={loading}><Flag className="size-4" /> {t("report.send")}</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("report.intro")}</p>
        <Field label={t("report.reason")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("report.reasonPlaceholder")} className="min-h-28" />
        </Field>
      </div>
    </Sheet>
  )
}
