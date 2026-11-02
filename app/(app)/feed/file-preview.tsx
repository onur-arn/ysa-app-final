"use client"

import { FileText, X } from "lucide-react"
import { formatBytes } from "@/lib/utils"

export function FileChipPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const pdf = file.name.toLowerCase().endsWith(".pdf")
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2.5">
      <span className={`flex size-10 items-center justify-center rounded-xl text-[10px] font-black ${pdf ? "bg-red-500 text-white" : "bg-primary/12 text-primary"}`}>{pdf ? "PDF" : <FileText className="size-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{file.name}</span>
        <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <button onClick={onRemove} className="flex size-8 items-center justify-center rounded-full bg-secondary" aria-label="remove"><X className="size-4" /></button>
    </div>
  )
}
