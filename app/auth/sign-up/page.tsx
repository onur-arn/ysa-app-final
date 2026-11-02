"use client"

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Toggle } from "@/components/ui/sheet"
import { BOARD_POSITIONS, EXECUTIVE_POSITIONS, HOMETOWNS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
import { useI18n } from "@/lib/i18n/context"
import type { Station } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AuthFrame, IconInput } from "../auth-frame"

// Maps are heavy (topojson): load them only on the step that shows them.
const EuropeMap = dynamic(() => import("./europe-map").then((m) => m.EuropeMap), { ssr: false, loading: () => <div className="aspect-[540/340] animate-pulse rounded-2xl bg-secondary" /> })
const TurkeyMap = dynamic(() => import("./turkey-map").then((m) => m.TurkeyMap), { ssr: false, loading: () => <div className="aspect-[2/1] animate-pulse rounded-2xl bg-secondary" /> })

type Form = {
  first_name: string
  last_name: string
  email: string
  password: string
  station_id: string
  position: string
  igem_trained: boolean
  igem_date: string
  phone: string
  birthday: string
  hometown: string
  linkedin: string
  consent: boolean
}

const EMPTY: Form = {
  first_name: "", last_name: "", email: "", password: "", station_id: "", position: "", igem_trained: false,
  igem_date: "", phone: "", birthday: "", hometown: "", linkedin: "", consent: false,
}

export default function SignUpPage() {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [stations, setStations] = useState<Station[]>([])
  const [taken, setTaken] = useState<{ station_id: string; position: string }[]>([])
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.from("stations").select("*").order("position").then(({ data }) => setStations((data ?? []) as Station[]))
    void supabase.rpc("taken_positions").then(({ data }) => setTaken((data ?? []) as typeof taken))
  }, [])

  const takenHere = useMemo(
    () => new Set(taken.filter((x) => x.station_id === form.station_id).map((x) => x.position)),
    [taken, form.station_id],
  )

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  function validate(): string | null {
    if (step === 0) {
      if (!form.first_name.trim() || !form.last_name.trim()) return t("auth.err.name")
      if (!/^\S+@\S+\.\S+$/.test(form.email)) return t("auth.err.email")
      if (form.password.length < 8) return t("auth.pwTooShort")
    }
    if (step === 1 && !form.station_id) return t("auth.err.station")
    if (step === 2 && !form.consent) return t("auth.err.consent")
    return null
  }

  async function next() {
    const err = validate()
    setError(err)
    if (err) return
    if (step < 2) return setStep(step + 1)

    setLoading(true)
    const { error } = await createClient().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/pending`,
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          station_id: form.station_id,
          position: form.position || null,
          igem_trained: form.igem_trained,
          igem_date: form.igem_trained ? form.igem_date : "",
          phone: form.phone.trim(),
          birthday: form.birthday,
          hometown: form.hometown,
          linkedin: form.linkedin.trim(),
        },
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message.toLowerCase().includes("registered") ? t("auth.err.exists") : error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthFrame title={t("auth.signupDoneTitle")}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground text-pretty">{t("auth.signupDoneText")}</p>
          <Link href="/auth/login" className="mt-2 text-sm font-semibold text-primary">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </AuthFrame>
    )
  }

  const steps = [t("auth.step.account"), t("auth.step.association"), t("auth.step.contact")]

  return (
    <AuthFrame title={t("auth.signupTitle")} subtitle={t("auth.signupSubtitle")} wide>
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
            <span className={cn("text-[11px] font-semibold", i === step ? "text-primary" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("profile.firstName")}>
                <IconInput icon={User} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
              </Field>
              <Field label={t("profile.lastName")}>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" className="rounded-xl bg-card" />
              </Field>
            </div>
            <Field label={t("auth.email")}>
              <IconInput icon={Mail} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
            </Field>
            <Field label={t("auth.password")} hint={t("auth.pwHint")}>
              <IconInput
                icon={Lock}
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                right={
                  <button type="button" onClick={() => setShow((v) => !v)} className="text-muted-foreground" aria-label="toggle">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t("profile.station")}>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <EuropeMap stations={stations} selected={form.station_id} onSelect={(id) => setForm((f) => ({ ...f, station_id: id, position: "" }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stations.map((s) => {
                  const active = form.station_id === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, station_id: s.id, position: "" }))}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                        active ? "border-transparent text-white" : "border-border bg-card text-foreground",
                      )}
                      style={active ? { backgroundColor: `hsl(${s.color})` } : undefined}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: active ? "white" : `hsl(${s.color})` }} />
                      <span className="truncate">{s.city}</span>
                      {active && <Check className="ml-auto size-4" />}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label={t("profile.position")} hint={t("auth.positionHint")}>
              <Select value={form.position} onChange={(e) => set("position", e.target.value)} disabled={!form.station_id}>
                <option value="">{t("profile.memberOnly")}</option>
                <optgroup label={t("profile.boardGroup")}>
                  {BOARD_POSITIONS.map((p) => (
                    <option key={p} value={p} disabled={takenHere.has(p)}>
                      {p}
                      {takenHere.has(p) ? ` (${t("auth.taken")})` : ""}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("profile.executiveGroup")}>
                  {EXECUTIVE_POSITIONS.map((p) => (
                    <option key={p} value={p} disabled={takenHere.has(p)}>
                      {p}
                      {takenHere.has(p) ? ` (${t("auth.taken")})` : ""}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Toggle checked={form.igem_trained} onChange={(v) => set("igem_trained", v)} label={t("profile.igemTrained")} />
            {form.igem_trained && (
              <Field label={t("profile.igemDate")}>
                <Input type="date" value={form.igem_date} onChange={(e) => set("igem_date", e.target.value)} />
              </Field>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Field label={t("profile.phone")}>
              <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 …" autoComplete="tel" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("profile.birthday")}>
                <Input type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
              </Field>
              <Field label={t("profile.hometown")}>
                <Select value={form.hometown} onChange={(e) => set("hometown", e.target.value)}>
                  <option value="">{t("auth.pickHometown")}</option>
                  {HOMETOWNS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <TurkeyMap selected={form.hometown} onSelect={(h) => set("hometown", h)} />
            </div>
            <Field label="LinkedIn">
              <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" />
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>{t("auth.consent")}</span>
            </label>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-2 flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="lg" onClick={() => setStep(step - 1)} aria-label="back">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={next} loading={loading}>
            {step < 2 ? (
              <>
                {t("common.next")} <ArrowRight className="size-4" />
              </>
            ) : (
              t("auth.submitSignup")
            )}
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link href="/auth/login" className="font-semibold text-primary">
          {t("auth.login")}
        </Link>
      </p>
    </AuthFrame>
  )
}
