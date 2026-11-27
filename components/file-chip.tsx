"use client"

import { Download, FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import { usePdfViewer } from "@/components/pdf-viewer"
import { toast } from "@/components/ui/toast"
import { useI18n } from "@/lib/i18n/context"
import { downloadFile } from "@/lib/upload"
import { cn, formatBytes } from "@/lib/utils"

/** Downloadable document (PDF in chat or on the feed). */
export function FileChip({ path, name, size, inverted }: { path: string; name: string; size?: number | null; inverted?: boolean }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const isPdf = name.toLowerCase().endsWith(".pdf")
  const pdf = usePdfViewer()

  async function run(mode: "download" | "open") {
    if (mode === "open" && isPdf) return pdf.open({ path, name })   // PDFs open inside the app
    setBusy(true)
    try {
      await downloadFile(path, name, mode)
    } catch {
      toast(t("common.error"), { error: true })
    }
    setBusy(false)
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-2.5", inverted ? "bg-primary-foreground/15" : "border border-border bg-background")}>
      <button onClick={() => run("open")} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-black", isPdf ? "bg-red-500 text-white" : inverted ? "bg-primary-foreground/25" : "bg-primary/12 text-primary")}>
          {isPdf ? "PDF" : <FileText className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className={cn("block text-[11px]", inverted ? "opacity-75" : "text-muted-foreground")}>{formatBytes(size)}{size ? " · " : ""}{t("files.tapToOpen")}</span>
        </span>
      </button>
      <button onClick={() => run("download")} disabled={busy} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", inverted ? "bg-primary-foreground/20" : "bg-secondary text-foreground")} aria-label={t("files.download")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      </button>
    </div>
  )
}
