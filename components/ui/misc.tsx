"use client"

import { cn } from "@/lib/utils"
import { TONE, type Tone } from "@/lib/constants"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TONE[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-sm shadow-black/[0.02]", className)} {...props}>
      {children}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </span>
      <p className="font-heading text-base font-bold text-foreground">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted-foreground text-pretty">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Segmented control (same look as the original feed tabs) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  layoutId = "seg",
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: ReactNode; count?: number }[]
  className?: string
  layoutId?: string
}) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-secondary/70 p-1", className)}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 600, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span className="relative rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Horizontal scrollable chips used for filters */
export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: ReactNode; color?: string }[]
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {o.color && <span className="size-1.5 rounded-full" style={{ backgroundColor: `hsl(${o.color})` }} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  href,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  href?: string
}) {
  const inner = (
    <Card className="flex h-full flex-col gap-2 p-3.5">
      <span className={cn("flex size-9 items-center justify-center rounded-xl", TONE[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <div>
        <p className="font-heading text-xl font-bold leading-tight tracking-tight text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</p>}
      </div>
    </Card>
  )
  return href ? <a href={href} className="block transition-transform active:scale-[0.98]">{inner}</a> : inner
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {action}
    </div>
  )
}

export function Fab({ onClick, icon: Icon, label }: { onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <motion.button
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-28 right-5 z-20 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 md:bottom-8 md:right-8"
    >
      <Icon className="size-6" />
    </motion.button>
  )
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "green" | "amber" | "red" }) {
  const colors = { primary: "bg-primary", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-all", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
