import { CalendarDays, Home, ListChecks, MessageCircle, Settings, ShieldCheck, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavItem = { href: string; icon: LucideIcon; key: string; adminOnly?: boolean }

/** Same order as v1: Rehber · Mesajlar · Ana sayfa · Takvim · Görevler */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/annuaire", icon: Users, key: "nav.directory" },
  { href: "/messages", icon: MessageCircle, key: "nav.messages" },
  { href: "/feed", icon: Home, key: "nav.feed" },
  { href: "/agenda", icon: CalendarDays, key: "nav.agenda" },
  { href: "/gorevler", icon: ListChecks, key: "nav.tasks" },
]

export const SIDE_NAV: NavItem[] = [
  BOTTOM_NAV[2], BOTTOM_NAV[1], BOTTOM_NAV[3], BOTTOM_NAV[4], BOTTOM_NAV[0],
  { href: "/ayarlar", icon: Settings, key: "nav.settings" },
  { href: "/yonetici", icon: ShieldCheck, key: "nav.admin", adminOnly: true },
]

export const PAGE_TITLES: [string, string][] = [
  ["/feed", "nav.feed"], ["/messages", "nav.messages"], ["/agenda", "nav.agenda"], ["/gorevler", "nav.tasks"],
  ["/annuaire", "nav.directory"], ["/ayarlar", "nav.settings"], ["/yonetici", "nav.admin"],
]
