"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { useUnreadMessages } from "@/lib/data/hooks"
import { BOTTOM_NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()
  const unread = useUnreadMessages()
  return (
    <nav className="no-print fixed bottom-6 left-4 right-4 z-30 mx-auto max-w-md select-none rounded-2xl border border-border/60 bg-card/92 shadow-xl shadow-black/[0.08] backdrop-blur-2xl md:hidden">
      <ul className="flex items-stretch justify-around px-1 py-1">
        {BOTTOM_NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link href={item.href} prefetch className="relative flex h-14 flex-col items-center justify-center gap-0.5">
                {active && (
                  <motion.span layoutId="nav-bg" className="absolute inset-x-1 inset-y-1 rounded-xl bg-primary/10" transition={{ type: "spring", stiffness: 800, damping: 32 }} />
                )}
                <span className="relative">
                  <Icon className={cn("size-5 transition-colors", active ? "text-primary" : "text-muted-foreground/70")} strokeWidth={active ? 2.5 : 1.8} />
                  {item.href === "/messages" && unread > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-card">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                <span className={cn("relative text-[9.5px] font-semibold leading-none tracking-wide transition-colors", active ? "text-primary" : "text-muted-foreground/60")}>
                  {t(item.key)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
