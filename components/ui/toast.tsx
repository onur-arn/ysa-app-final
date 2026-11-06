"use client"

import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

type ToastItem = { id: number; text: string; error?: boolean }
const EVENT = "ysa-toast"

/** Fire-and-forget toast, callable from anywhere on the client. */
export function toast(text: string, opts?: { error?: boolean }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, error: opts?.error } }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    let n = 0
    const on = (e: Event) => {
      const { text, error } = (e as CustomEvent<{ text: string; error?: boolean }>).detail
      const id = ++n
      setItems((prev) => [...prev, { id, text, error }])
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 3200)
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] z-[70] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((i) => (
          <motion.div
            key={i.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-xl"
          >
            {i.error ? <XCircle className="size-4 shrink-0 text-destructive" /> : <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
            {i.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
