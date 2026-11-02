"use client"

import { AtSign, Bell, CalendarDays, CheckCheck, ListChecks, MessageCircle, MessageSquare, UserPlus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap, useNotifications } from "@/lib/data/hooks"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, typeof Bell> = {
  message: MessageCircle, mention: AtSign, task: ListChecks, event: CalendarDays, member: UserPlus, comment: MessageSquare,
}
const TONES: Record<string, string> = {
  message: "bg-primary/12 text-primary", mention: "bg-violet-500/12 text-violet-600", task: "bg-amber-500/14 text-amber-600",
  event: "bg-sky-500/12 text-sky-600", member: "bg-emerald-500/12 text-emerald-600", comment: "bg-secondary text-foreground",
}

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, fmtRelative } = useI18n()
  const { me } = useApp()
  const member = useMemberMap()
  const router = useRouter()
  const qc = useQueryClient()
  const { data = [] } = useNotifications()
  const supabase = createClient()
  const unread = data.filter((n) => !n.read_at).length

  function markLocal(pred: (n: Notification) => boolean) {
    qc.setQueryData<Notification[]>(qk.notifications, (old) => old?.map((n) => (pred(n) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
  }

  async function readAll() {
    markLocal(() => true)
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).is("read_at", null)
  }

  async function open_(n: Notification) {
    markLocal((x) => x.id === n.id)
    onClose()
    if (n.link) router.push(n.link)
    if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("notif.title")}
      footer={unread > 0 ? <Button variant="secondary" className="w-full" onClick={readAll}><CheckCheck className="size-4" /> {t("notif.readAll")}</Button> : undefined}
    >
      {data.length === 0 ? (
        <EmptyState icon={Bell} title={t("notif.empty")} text={t("notif.emptyText")} />
      ) : (
        <div className="-mx-2 flex flex-col">
          {data.map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            const actor = member(n.actor_id)
            return (
              <button key={n.id} onClick={() => open_(n)} className={cn("flex items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/60", !n.read_at && "bg-primary/5")}>
                <span className="relative shrink-0">
                  {actor ? (
                    <Avatar name={actor.full_name} photoUrl={actor.photo_url} stationId={actor.station_id} size={42} />
                  ) : (
                    <span className={cn("flex size-[42px] items-center justify-center rounded-full", TONES[n.type])}><Icon className="size-5" /></span>
                  )}
                  {actor && (
                    <span className={cn("absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full ring-2 ring-card", TONES[n.type])}>
                      <Icon className="size-3" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("flex-1 truncate text-sm text-foreground", n.read_at ? "font-medium" : "font-bold")}>{n.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmtRelative(n.created_at)}</span>
                  </span>
                  {n.body && <span className="line-clamp-2 text-[13px] text-muted-foreground">{n.body}</span>}
                </span>
                {!n.read_at && (
                  <span className="mt-1 flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
                    {n.type === "message" && n.count > 1 ? n.count : ""}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
