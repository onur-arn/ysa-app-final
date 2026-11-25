"use client"

import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { LINK_RE, openLink } from "@/lib/open-link"
import { cn } from "@/lib/utils"

/** Text where every web link is tappable (opened inside the app). */
export function Linkified({ text, className }: { text: string; className?: string }) {
  const router = useRouter()
  if (!/https?:\/\/|www\./i.test(text)) return <>{text}</>
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    const href = m[0]
    parts.push(
      <span
        key={start}
        role="link"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); void openLink(href, (p) => router.push(p)) }}
        onKeyDown={(e) => { if (e.key === "Enter") void openLink(href, (p) => router.push(p)) }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={cn("cursor-pointer break-all underline underline-offset-2", className)}
      >
        {href.replace(/^https?:\/\//i, "")}
      </span>,
    )
    last = start + href.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
