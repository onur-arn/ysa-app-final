"use client"

import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame, IconInput } from "../auth-frame"

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t("auth.pwTooShort"))
    if (password !== confirm) return setError(t("auth.pwMismatch"))
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(t("auth.resetExpired"))
    toast(t("auth.pwUpdated"))
    router.replace("/feed")
  }

  return (
    <AuthFrame title={t("auth.newPassword")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <IconInput icon={Lock} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.newPassword")} />
        <IconInput icon={Lock} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("auth.confirmPassword")} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" loading={loading}>
          {t("common.save")}
        </Button>
      </form>
    </AuthFrame>
  )
}
