"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/logo"
import { useApp } from "@/components/providers/app-context"
import { useI18n } from "@/lib/i18n/context"
import { useUnreadMessages } from "@/lib/data/hooks"
import { SIDE_NAV } from "@/lib/nav"
import { isAdmin } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { me } = useApp()
  const unread = useUnreadMessages()
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar px-3 py-5 md:flex">
      <Link href="/feed" className="mb-6 flex items-center gap-2.5 px-2">
        <Logo size={36} />
        <span className="font-heading text-lg font-bold tracking-tight text-foreground">YouthStation</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5">
        {SIDE_NAV.filter((i) => !i.adminOnly || isAdmin(me)).map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.9} />
              <span className="flex-1">{t(item.key)}</span>
              {item.href === "/messages" && unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
