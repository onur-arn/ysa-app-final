"use client"

import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import { AuthFrame, IconInput } from "../auth-frame"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message.includes("Email not confirmed") ? t("auth.notConfirmed") : t("auth.invalid"))
      setLoading(false)
      return
    }
    const next = params.get("next")
    router.replace(next && next.startsWith("/") ? next : "/feed")
    router.refresh()
  }

  return (
    <AuthFrame
      title={<>Youth<span className="text-primary">Station</span></>}
      subtitle={t("auth.tagline")}
      footer={
        <>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <Button type="submit" form="login-form" size="lg" loading={loading} className="w-full">
            {t("auth.login")}
          </Button>
        </>
      }
    >
      <form id="login-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{t("auth.email")}</span>
          <IconInput icon={Mail} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="uye@youthstation.org" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{t("auth.password")}</span>
          <IconInput
            icon={Lock}
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            right={
              <button type="button" onClick={() => setShow((v) => !v)} className="text-muted-foreground hover:text-foreground" aria-label="toggle">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </label>
        <div className="-mt-1 flex justify-end">
          <Link href="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
            {t("auth.forgot")}
          </Link>
        </div>
      </form>
    </AuthFrame>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
