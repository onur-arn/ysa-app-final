"use client"

import { motion } from "framer-motion"
import { CalendarDays, MessageCircle, Moon, Sun, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "@/lib/theme/context"

const FEATURES = [
  { icon: MessageCircle, label: "Mesajlar" },
  { icon: CalendarDays, label: "Takvim" },
  { icon: Users, label: "Rehber" },
]

const rise = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.45, ease: "easeOut" as const } })

/** First screen for signed-out visitors: Giriş yap / Kayıt ol. */
export function Welcome() {
  const { theme, toggle } = useTheme()
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      {/* soft background glow in the brand colour */}
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 size-80 rounded-full bg-sky-400/10 blur-[80px]" />

      <div className="relative flex justify-end">
        <button onClick={toggle} aria-label="Tema" className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="relative">
          <div className="absolute inset-0 scale-125 rounded-[28px] bg-primary/25 blur-2xl" />
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="relative rounded-[26px] bg-white p-3.5 shadow-2xl shadow-primary/20">
            <Image src="/youthstation-logo.jpg" alt="YouthStation" width={104} height={104} priority className="block object-contain" />
          </motion.div>
        </motion.div>

        <motion.h1 {...rise(0.15)} className="mt-7 font-heading text-[2rem] font-bold tracking-tight text-foreground">
          Youth<span className="text-primary">Station</span>
        </motion.h1>
        <motion.p {...rise(0.25)} className="mt-2 max-w-xs text-[15px] text-muted-foreground text-pretty">
          Gençlik topluluğunun uygulaması. İletişim, organizasyon ve dayanışma tek bir yerde.
        </motion.p>

        <motion.div {...rise(0.35)} className="mt-7 flex gap-2">
          {FEATURES.map((f) => (
            <span key={f.label} className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
              <f.icon className="size-3.5 text-primary" /> {f.label}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div {...rise(0.45)} className="relative mx-auto flex w-full max-w-sm flex-col gap-3">
        <Link href="/auth/login" className="flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]">
          Giriş yap
        </Link>
        <Link href="/auth/sign-up" className="flex h-12 items-center justify-center rounded-2xl border border-border bg-card text-base font-semibold text-foreground transition-transform active:scale-[0.98]">
          Kayıt ol
        </Link>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">Sadece üyelere özel erişim</p>
      </motion.div>
    </main>
  )
}
