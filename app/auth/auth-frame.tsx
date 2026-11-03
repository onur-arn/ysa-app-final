"use client"

import { HomeButton } from "@/components/home-button"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared layout of every first screen, built for phones:
 *   top    → Home button (aligned with the content column)
 *   middle → title and content, centred
 *   bottom → the main action, always at the same place (thumb reach), with the safe area
 */
export function AuthShell({ children, footer, ownFooter }: { children: ReactNode; footer?: ReactNode; ownFooter?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <HomeButton />
        <div className="flex flex-1 flex-col">{children}</div>
        {footer ? <AuthFooter>{footer}</AuthFooter> : !ownFooter && <div className="h-10" />}
      </div>
    </main>
  )
}

/** Bottom action bar: stays visible at the bottom of the screen, even on long forms. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-auto border-t border-border/60 bg-background/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function AuthTitle({ title, subtitle }: { title: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-10 flex flex-col items-center gap-2 text-center">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="max-w-[18rem] text-sm text-muted-foreground text-pretty">{subtitle}</p>}
    </div>
  )
}

/** Title + content centred vertically, main action at the bottom. */
export function AuthFrame({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <AuthShell footer={footer}>
      <div className="flex flex-1 flex-col justify-center py-10">
        <AuthTitle title={title} subtitle={subtitle} />
        {children}
      </div>
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
