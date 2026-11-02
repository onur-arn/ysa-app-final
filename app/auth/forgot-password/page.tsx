"use client"

import { Mail, MailCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame, IconInput } from "../auth-frame"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    // Always show success so the form does not reveal which e-mails exist.
    setSent(true)
    setLoading(false)
  }

  return (
    <AuthFrame title={t("auth.forgotTitle")} subtitle={sent ? undefined : t("auth.forgotText")}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="text-sm text-foreground">{t("auth.forgotSent")}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <IconInput icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} />
          <Button type="submit" size="lg" loading={loading}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/auth/login" className="font-semibold text-primary">
          ← {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthFrame>
  )
}
