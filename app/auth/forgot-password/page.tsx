"use client"

import { Mail, MailCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame, IconInput } from "../auth-frame"

/** Step 1: ask for the 6-digit code, e-mailed by the app through Brevo. */
export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => null)
    setLoading(false)
    if (res?.ok) return setSent(true)
    const code = ((await res?.json().catch(() => ({}))) as { error?: string })?.error
    setError(code === "invalid_email" ? t("auth.err.email") : t("auth.forgotFailed"))
  }

  const resetHref = `/auth/reset-password?email=${encodeURIComponent(email.trim())}`

  return (
    <AuthFrame
      title={t("auth.forgotTitle")}
      subtitle={sent ? undefined : t("auth.forgotText")}
      footer={
        sent ? (
          <Link href={resetHref} className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground">{t("auth.enterCode")}</Link>
        ) : (
          <>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button type="submit" form="forgot-form" size="lg" loading={loading} className="w-full">{t("auth.sendCode")}</Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10"><MailCheck className="size-8 text-primary" /></span>
          <p className="max-w-xs text-sm text-muted-foreground text-pretty">{t("auth.codeSent")}</p>
        </div>
      ) : (
        <form id="forgot-form" onSubmit={onSubmit}>
          <IconInput icon={Mail} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="uye@youthstation.org" />
        </form>
      )}
    </AuthFrame>
  )
}
