"use client"

import { motion } from "framer-motion"
import { Moon, Sun } from "lucide-react"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { LANGS } from "@/lib/i18n/config"
import { useI18n } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme/context"
import { cn } from "@/lib/utils"

export function AuthFrame({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useI18n()
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn("rounded-lg px-2 py-1 text-xs font-bold uppercase", lang === l.code ? "bg-primary/10 text-primary" : "text-muted-foreground")}
            >
              {l.code}
            </button>
          ))}
        </div>
        <button
          onClick={toggle}
          aria-label="Theme"
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="size-16" size={64} />
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
        </div>
        {children}
      </motion.div>
    </main>
  )
}

export function IconInput({
  icon: Icon,
  right,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ComponentType<{ className?: string }>; right?: ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={cn(
          "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30",
          className,
        )}
        {...props}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}
