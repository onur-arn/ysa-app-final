"use client"

import { HomeButton } from "@/components/home-button"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared grid of every auth screen: same 24 px gutter, Home button aligned with
 * the content column, content anchored at the same height on every page.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-6 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-sm">
        <HomeButton />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  )
}

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
    </div>
  )
}

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <AuthShell>
      <AuthTitle title={title} subtitle={subtitle} />
      {children}
    </AuthShell>
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
