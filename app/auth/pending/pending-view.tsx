"use client"

import { Clock, LogOut, ShieldX } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame } from "../auth-frame"

export function PendingView({ status, firstName }: { status: string; firstName: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const blocked = status === "suspended" || status === "rejected" || status === "alumni"

  async function logout() {
    await createClient().auth.signOut()
    router.replace("/auth/login")
  }

  return (
    <AuthFrame
      title={blocked ? t("auth.blockedTitle") : t("auth.pendingTitle", { name: firstName })}
      footer={
        <>
          {!blocked && <Button size="lg" className="w-full" onClick={() => router.refresh()}>{t("auth.checkAgain")}</Button>}
          <Button variant="outline" size="lg" className="w-full" onClick={logout}><LogOut className="size-4" /> {t("settings.logout")}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={blocked ? "flex size-16 items-center justify-center rounded-2xl bg-destructive/10" : "flex size-16 items-center justify-center rounded-2xl bg-primary/10"}>
          {blocked ? <ShieldX className="size-8 text-destructive" /> : <Clock className="size-8 text-primary" />}
        </span>
        <p className="max-w-xs text-sm text-muted-foreground text-pretty">{blocked ? t(`auth.blocked.${status}`) : t("auth.pendingText")}</p>
      </div>
    </AuthFrame>
  )
}
