"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion, useDragControls } from "framer-motion"
import { X } from "lucide-react"
import { type ReactNode, useEffect } from "react"

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  zClass = "z-50",
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Stacking level, for sheets opened above a full-screen overlay. */
  zClass?: string
}) {
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn("fixed inset-0 bg-foreground/40 backdrop-blur-sm", zClass)}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            // pull down from the header to close; the body keeps scrolling normally
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            dragMomentum={false}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose()
            }}
            className={cn("fixed inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl md:bottom-auto md:top-1/2 md:max-h-[85dvh] md:-translate-y-1/2 md:rounded-3xl", zClass)}
          >
            <div onPointerDown={(e) => drag.start(e)} className="relative flex touch-none items-center justify-between gap-3 px-5 pb-2 pt-5">
              <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-border md:hidden" />
              <h2 className="min-w-0 truncate font-heading text-lg font-bold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-6 pt-2">{children}</div>
            {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const fieldBase =
  "w-full rounded-2xl border border-border bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-12", className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-12 appearance-none bg-[length:16px] pr-10", className)} {...props}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm"
    >
      <span className="text-foreground">{label}</span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-card shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  )
}
