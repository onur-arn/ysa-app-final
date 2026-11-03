"use client"

import { HomeButton } from "@/components/home-button"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function AuthFrame({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <HomeButton />
      <div className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}>
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
        </div>
        {children}
      </div>
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
