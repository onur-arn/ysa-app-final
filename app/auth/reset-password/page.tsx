"use client"

import { KeyRound, Lock, Mail } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame, IconInput } from "../auth-frame"

/** Step 2: code (pre-filled from the e-mail link) + new password. */
function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t } = useI18n()
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [code, setCode] = useState(params.get("code") ?? "")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t("auth.pwTooShort"))
    if (password !== confirm) return setError(t("auth.pwMismatch"))
    setLoading(true)
    setError(null)
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
    }).catch(() => null)
    setLoading(false)
    if (!res?.ok) return setError(((await res?.json().catch(() => ({}))) as { error?: string })?.error ?? t("common.error"))
    toast(t("auth.pwUpdated"))
    router.replace("/auth/login")
  }

  return (
    <AuthFrame
      title={t("auth.newPassword")}
      subtitle={t("auth.resetText")}
      footer={
        <>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <Button type="submit" form="reset-form" size="lg" loading={loading} className="w-full">{t("auth.updatePassword")}</Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {!params.get("email") && <IconInput icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="uye@youthstation.org" />}
        <IconInput
          icon={KeyRound}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
        <IconInput icon={Lock} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.newPassword")} />
        <IconInput icon={Lock} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("auth.confirmPassword")} />
      </form>
    </AuthFrame>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
