"use client"

import { cn } from "@/lib/utils"
import { useApp } from "@/components/providers/app-context"
import { useI18n } from "@/lib/i18n/context"

export function StationBadge({ id, short, className }: { id: string | null | undefined; short?: boolean; className?: string }) {
  const { station } = useApp()
  const { t } = useI18n()
  const s = station(id)
  const color = s?.color ?? "188 57% 48%"
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      style={{ backgroundColor: `hsl(${color} / 0.14)`, color: `hsl(${color})` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
      {s ? (short ? s.short : s.name) : t("common.allStations")}
    </span>
  )
}
