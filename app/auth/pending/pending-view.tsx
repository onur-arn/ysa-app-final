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
    <AuthFrame title={blocked ? t("auth.blockedTitle") : t("auth.pendingTitle", { name: firstName })}>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
        {blocked ? <ShieldX className="size-10 text-destructive" /> : <Clock className="size-10 text-primary" />}
        <p className="text-sm text-muted-foreground text-pretty">{blocked ? t(`auth.blocked.${status}`) : t("auth.pendingText")}</p>
        <div className="flex w-full gap-2">
          {!blocked && (
            <Button variant="secondary" className="flex-1" onClick={() => router.refresh()}>
              {t("auth.checkAgain")}
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={logout}>
            <LogOut className="size-4" /> {t("settings.logout")}
          </Button>
        </div>
      </div>
    </AuthFrame>
  )
}
