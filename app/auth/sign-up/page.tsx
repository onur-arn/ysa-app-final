"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Cake, Camera, Check, CheckCircle2, ChevronLeft, ExternalLink, Eye, EyeOff, Loader2, Lock, Mail, MapPin, Moon, Phone, Sun, User } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { BOARD_POSITIONS, EXECUTIVE_POSITIONS, HOMETOWNS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "@/lib/theme/context"
import type { Station } from "@/lib/types"
import { compressImage } from "@/lib/upload"
import { cn } from "@/lib/utils"

// Maps are heavy (topojson): loaded only on the step that shows them.
const EuropeMap = dynamic(() => import("./europe-map").then((m) => m.EuropeMap), { ssr: false, loading: () => <MapPlaceholder /> })
const TurkeyMap = dynamic(() => import("./turkey-map").then((m) => m.TurkeyMap), { ssr: false, loading: () => <MapPlaceholder /> })

function MapPlaceholder() {
  return <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">Harita yükleniyor…</div>
}

type Form = {
  first_name: string; last_name: string; email: string; password: string; phone: string; birthday: string; linkedin: string
  station_id: string; position: string; igem: "evet" | "hayır" | ""; igem_date: string; hometown: string; consent: boolean
}
const EMPTY: Form = { first_name: "", last_name: "", email: "", password: "", phone: "", birthday: "", linkedin: "", station_id: "", position: "", igem: "", igem_date: "", hometown: "", consent: false }

const field = "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
const slide = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
}

function Field({ label, icon: Icon, children }: { label: ReactNode; icon?: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
        {children}
      </span>
    </label>
  )
}

export default function SignUpPage() {
  const { theme, toggle } = useTheme()
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [f, setF] = useState<Form>(EMPTY)
  const [photo, setPhoto] = useState<File | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [taken, setTaken] = useState<{ station_id: string; position: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.from("stations").select("*").order("position").then(({ data }) => setStations((data ?? []) as Station[]))
    void supabase.rpc("taken_positions").then(({ data }) => setTaken((data ?? []) as typeof taken))
  }, [])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }))
  const go = (delta: number) => {
    setError(null)
    setDir(delta)
    setStep((s) => s + delta)
  }

  async function submit() {
    setLoading(true)
    setError(null)
    const body = new FormData()
    body.append("file", await compressImage(photo!, 800, 0.85))
    const up = (await fetch("/api/signup-photo", { method: "POST", body }).then((r) => r.json()).catch(() => ({}))) as { url?: string }
    if (!up.url) {
      setLoading(false)
      return setError("Fotoğraf yüklenemedi, başka bir fotoğraf deneyin.")
    }
    const { error } = await createClient().auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/pending`,
        data: {
          first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim(), birthday: f.birthday, linkedin: f.linkedin.trim(),
          station_id: f.station_id, position: f.position || null, igem_trained: f.igem === "evet", igem_date: f.igem === "evet" ? f.igem_date : "",
          hometown: f.hometown, photo_url: up.url,
        },
      },
    })
    setLoading(false)
    if (error) return setError(error.message.toLowerCase().includes("registered") ? "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin." : "Bir hata oluştu. Lütfen tekrar deneyin.")
    go(1)
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="absolute right-4 top-4">
        <button onClick={toggle} aria-label="Tema" className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Link href="/" aria-label="YouthStation"><Logo size={48} /></Link>
        </div>
        {step < 4 && (
          <div className="mb-6 flex items-center gap-1.5">
            {[1, 2, 3].map((i) => <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all duration-300", step >= i ? "bg-primary" : "bg-border")} />)}
          </div>
        )}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: "easeInOut" }}>
            {step === 1 && <Step1 f={f} set={set} photo={photo} setPhoto={setPhoto} onNext={() => go(1)} />}
            {step === 2 && <Step2 f={f} set={set} stations={stations} taken={taken} onNext={() => go(1)} onBack={() => go(-1)} />}
            {step === 3 && <Step3 f={f} set={set} onBack={() => go(-1)} onSubmit={submit} loading={loading} error={error} />}
            {step === 4 && <Success email={f.email} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

type StepProps = { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }

function Step1({ f, set, photo, setPhoto, onNext }: StepProps & { photo: File | null; setPhoto: (p: File | null) => void; onNext: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [show, setShow] = useState(false)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email)
  const canNext = !!photo && f.first_name.trim() && f.last_name.trim() && emailOk && f.password.length >= 8

  return (
    <div>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">İletişim bilgileri</h1>
      <p className="mb-6 text-sm text-muted-foreground">Adım 1 / 3</p>
      <form onSubmit={(e) => { e.preventDefault(); if (canNext) onNext() }} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-card transition-colors hover:border-primary">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Profil" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-0.5 text-muted-foreground group-hover:text-primary">
                <Camera className="size-5" />
                <span className="text-[9px] font-medium">Fotoğraf ekle</span>
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          {!photo && <p className="text-[11px] text-destructive">Profil fotoğrafı zorunludur *</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ad" icon={User}><input required value={f.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Ayşe" autoComplete="given-name" className={field} /></Field>
          <Field label="Soyad" icon={User}><input required value={f.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Yılmaz" autoComplete="family-name" className={field} /></Field>
        </div>
        <Field label="E-posta" icon={Mail}><input type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="uye@youthstation.org" autoComplete="email" className={field} /></Field>
        <Field label="Şifre" icon={Lock}>
          <input type={show ? "text" : "password"} required minLength={8} value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="En az 8 karakter" autoComplete="new-password" className={cn(field, "pr-10")} />
          <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Şifreyi göster">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </Field>
        <Field label="Telefon" icon={Phone}><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 12 34 56 78" autoComplete="tel" className={field} /></Field>
        <Field label="Doğum tarihi" icon={Cake}><input type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} className={cn(field, "[appearance:none]")} /></Field>
        <Field label="LinkedIn (isteğe bağlı)" icon={ExternalLink}><input type="url" value={f.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" className={field} /></Field>
        <Button type="submit" size="lg" className="mt-2" disabled={!canNext}>Devam et</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Zaten üye misin? <Link href="/auth/login" className="font-semibold text-primary">Giriş yap</Link>
      </p>
    </div>
  )
}

function Step2({ f, set, stations, taken, onNext, onBack }: StepProps & { stations: Station[]; taken: { station_id: string; position: string }[]; onNext: () => void; onBack: () => void }) {
  const takenHere = new Set(taken.filter((x) => x.station_id === f.station_id).map((x) => x.position))
  const pickStation = (id: string) => {
    set("station_id", id)
    if (f.position && taken.some((x) => x.station_id === id && x.position === f.position)) set("position", "")
  }
  const option = (p: string) => <option key={p} value={p} disabled={takenHere.has(p)}>{p}{takenHere.has(p) ? " (dolu)" : ""}</option>
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" /> Geri</button>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Görev & İstasyon</h1>
      <p className="mb-5 text-sm text-muted-foreground">Adım 2 / 3</p>
      <div className="mb-5 flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><MapPin className="size-4 text-muted-foreground" /> İstasyonun <span className="text-destructive">*</span></span>
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-2">
          <EuropeMap stations={stations} selected={f.station_id} onSelect={pickStation} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stations.map((s) => {
            const sel = f.station_id === s.id
            return (
              <button key={s.id} type="button" onClick={() => pickStation(s.id)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors", sel ? "border-primary bg-primary/10 text-foreground" : "border-input bg-card text-muted-foreground")}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white" style={{ backgroundColor: `hsl(${s.color})` }}>{s.short}</span>
                <span className="truncate font-medium">{s.city}</span>
                {sel && <Check className="ml-auto size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </div>
      <label className="mb-6 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Görevin</span>
        <select value={f.position} onChange={(e) => set("position", e.target.value)} disabled={!f.station_id} className="h-12 w-full appearance-none rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none focus:border-ring disabled:opacity-60">
          <option value="">Üye (görev yok)</option>
          <optgroup label="Yönetim Kurulu">{BOARD_POSITIONS.map(option)}</optgroup>
          <optgroup label="Yürütme Kurulu">{EXECUTIVE_POSITIONS.map(option)}</optgroup>
        </select>
      </label>
      <Button size="lg" className="w-full" disabled={!f.station_id} onClick={onNext}>Devam et</Button>
    </div>
  )
}

function Step3({ f, set, onBack, onSubmit, loading, error }: StepProps & { onBack: () => void; onSubmit: () => void; loading: boolean; error: string | null }) {
  const canSubmit = !!f.hometown && f.igem !== "" && (f.igem === "hayır" || !!f.igem_date) && f.consent
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" /> Geri</button>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Eğitim & Memleket</h1>
      <p className="mb-5 text-sm text-muted-foreground">Adım 3 / 3</p>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">iGEM eğitimini gerçekleştirdiniz mi? <span className="text-destructive">*</span></p>
        <div className="flex gap-3">
          {(["evet", "hayır"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { set("igem", opt); if (opt === "hayır") set("igem_date", "") }}
              className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                f.igem === opt ? (opt === "evet" ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-destructive bg-destructive/10 text-destructive") : "border-border text-muted-foreground")}
            >
              {opt === "evet" ? <Check className="size-4" /> : <span className="text-base leading-none">✕</span>} {opt === "evet" ? "Evet" : "Hayır"}
            </button>
          ))}
        </div>
        {f.igem === "evet" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ne zaman? <span className="text-destructive">*</span></span>
            <input type="date" value={f.igem_date} onChange={(e) => set("igem_date", e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
          </label>
        )}
      </div>
      <p className="mb-2 text-sm font-semibold text-foreground">Memleket <span className="text-destructive">*</span></p>
      <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card p-2">
        <TurkeyMap selected={f.hometown} onSelect={(h) => set("hometown", h)} />
      </div>
      <select value={f.hometown} onChange={(e) => set("hometown", e.target.value)} className={cn("mb-4 h-12 w-full appearance-none rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-ring", !f.hometown && "text-muted-foreground")}>
        <option value="">İlinizi seçiniz</option>
        {HOMETOWNS.map((h) => <option key={h}>{h}</option>)}
      </select>
      <label className="mb-5 flex items-start gap-3 text-xs text-muted-foreground">
        <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>Bilgilerimin dernek üyeleri tarafından görülebileceğini ve dernek yönetimi amacıyla işleneceğini kabul ediyorum (KVKK / GDPR).</span>
      </label>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="w-full" disabled={loading || !canSubmit} onClick={onSubmit}>
        {loading ? <Loader2 className="size-5 animate-spin" /> : "Kayıt talebini gönder"}
      </Button>
    </div>
  )
}

function Success({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-emerald-500/15"><CheckCircle2 className="size-10 text-emerald-500" /></div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Talebiniz alındı!</h1>
      <p className="mt-3 text-sm text-muted-foreground text-pretty">Kaydınız başarıyla iletildi. Yönetici onayladıktan sonra hesabınız aktif hale gelecektir.</p>
      <p className="mt-2 text-sm text-muted-foreground text-pretty"><b className="text-foreground">{email}</b> adresine gönderilen onay e-postasını kontrol edin.</p>
      <Link href="/auth/login" className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground">Giriş sayfasına dön</Link>
    </div>
  )
}
