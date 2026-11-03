"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Bell } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Avatar } from "@/components/avatar"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useNotifications } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { PAGE_TITLES } from "@/lib/nav"
import { NOTIFY_EVENT } from "@/lib/realtime/hub"
import { registerServiceWorker } from "@/lib/push"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"
import { BottomNav } from "./bottom-nav"
import { NotificationsSheet } from "./notifications-sheet"
import { Sidebar } from "./sidebar"

/** Full-screen routes on mobile (open chat) */
const IMMERSIVE = /^\/messages\/[^/]+$/

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const { me } = useApp()
  const member = useMemberMap()
  const { data: notifs = [] } = useNotifications()
  const [bell, setBell] = useState(false)
  const [banner, setBanner] = useState<Notification | null>(null)
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const immersive = IMMERSIVE.test(pathname)
  const unread = notifs.filter((n) => !n.read_at).length
  const titleKey = PAGE_TITLES.find(([p]) => pathname.startsWith(p))?.[1]

  useEffect(() => void registerServiceWorker(), [])

  // Live alert for new notifications, wherever you are in the app.
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout>
    const on = (e: Event) => {
      const n = (e as CustomEvent<Notification>).detail
      if (n.link && pathRef.current === n.link.split("?")[0]) return // already looking at it
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker?.ready.then((reg) => reg.showNotification(n.title, { body: n.body ?? "", icon: "/icon.png", tag: n.id, data: { url: n.link ?? "/feed" } }))
        return
      }
      setBanner(n)
      clearTimeout(hide)
      hide = setTimeout(() => setBanner(null), 4500)
    }
    window.addEventListener(NOTIFY_EVENT, on)
    return () => {
      window.removeEventListener(NOTIFY_EVENT, on)
      clearTimeout(hide)
    }
  }, [])

  const actor = member(banner?.actor_id)

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <Sidebar />
      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-3xl flex-col">
        <header
          className={cn(
            "no-print sticky top-0 z-30 items-center justify-between border-b border-border/50 bg-background/85 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl",
            immersive ? "hidden md:flex" : "flex",
          )}
        >
          <h1 className="truncate font-heading text-[1.35rem] font-bold tracking-[-0.01em] text-foreground">{titleKey ? t(titleKey) : "YouthStation"}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBell(true)}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={t("notif.title")}
            >
              <motion.span key={unread} animate={unread ? { rotate: [0, -16, 14, -8, 0] } : {}} transition={{ duration: 0.5 }}>
                <Bell className="size-5" />
              </motion.span>
              {unread > 0 && (
                <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-background">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {/* block-level box exactly the size of the photo, so the ring is a perfect circle around it */}
            <Link href="/ayarlar" className="flex size-9 shrink-0 items-center justify-center rounded-full ring-2 ring-border/60 transition-all hover:ring-primary/40" aria-label={t("nav.settings")}>
              <Avatar name={me.full_name} photoUrl={me.photo_url} stationId={me.station_id} size={36} />
            </Link>
          </div>
        </header>
        <main className={cn("relative flex min-h-0 flex-1 flex-col", immersive ? "" : "pb-28 md:pb-10")}>{children}</main>
      </div>
      {!immersive && <BottomNav />}
      <NotificationsSheet open={bell} onClose={() => setBell(false)} />

      <AnimatePresence>
        {banner && (
          <motion.button
            initial={{ y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -90, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            onClick={() => {
              setBanner(null)
              if (banner.link) router.push(banner.link)
            }}
            className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[65] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 text-left shadow-2xl backdrop-blur-xl"
          >
            {actor ? <Avatar name={actor.full_name} photoUrl={actor.photo_url} stationId={actor.station_id} size={40} /> : <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary"><Bell className="size-5" /></span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">{banner.title}</span>
              {banner.body && <span className="block truncate text-[13px] text-muted-foreground">{banner.body}</span>}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
