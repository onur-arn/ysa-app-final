"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Bell, BellRing, Camera, Check, GraduationCap, KeyRound, Lock, LogOut, Palette, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { PRIVACY_URL, TERMS_URL } from "@/components/legal/legal-page"
import { PointsCard } from "@/components/profile/profile-sheet"
import { StationBadge } from "@/components/station-badge"
import { Button } from "@/components/ui/button"
import { Card, SectionTitle } from "@/components/ui/misc"
import { Field, Input, Select, Sheet, Textarea, Toggle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { HOMETOWNS } from "@/lib/constants"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isAdmin } from "@/lib/permissions"
import { disablePush, enablePush, pushEnabled, pushSupported, unlinkNativeDevice } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import { PALETTES, usePalette } from "@/lib/theme/context"
import type { NotifPrefs } from "@/lib/types"
import { compressImage, uploadMedia } from "@/lib/upload"
import { useHydrated } from "@/lib/use-hydrated"
import { cn } from "@/lib/utils"

export function SettingsClient() {
  const { me } = useApp()
  const { t } = useI18n()
  const { palette, setPalette } = usePalette()
  const hydrated = useHydrated()
  const router = useRouter()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [f, setF] = useState({ phone: me.phone ?? "", birthday: me.birthday ?? "", hometown: me.hometown ?? "", linkedin: me.linkedin ?? "" })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pw, setPw] = useState("")
  const [push, setPush] = useState(false)
  const [igem, setIgem] = useState(false)
  const [motivation, setMotivation] = useState("")

  useEffect(() => void pushEnabled().then(setPush), [])

  const refreshMe = () => {
    void qc.invalidateQueries({ queryKey: qk.me })
    void qc.invalidateQueries({ queryKey: qk.members })
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from("profiles").update({
      phone: f.phone.trim() || null, birthday: f.birthday || null,
      hometown: f.hometown || null, linkedin: f.linkedin.trim() || null,
    }).eq("id", me.id)
    setSaving(false)
    if (error) return toast(t("common.error"), { error: true })
    toast(t("common.saved"))
    refreshMe()
  }

  async function changePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadMedia(await compressImage(file, 512, 0.9), me.id, "avatar")
      await supabase.from("profiles").update({ photo_url: url }).eq("id", me.id)
      refreshMe()
    } catch {
      toast(t("common.error"), { error: true })
    }
    setUploading(false)
  }

  async function setPref(key: keyof NotifPrefs, value: boolean) {
    const notif_prefs = { ...me.notif_prefs, [key]: value }
    qc.setQueryData(qk.me, { ...me, notif_prefs })
    await supabase.from("profiles").update({ notif_prefs }).eq("id", me.id)
  }

  async function togglePush(v: boolean) {
    if (!v) {
      await disablePush()
      return setPush(false)
    }
    const res = await enablePush()
    if (res === "granted") {
      setPush(true)
      toast(t("settings.pushOn"))
    } else toast(t(`settings.push.${res}`), { error: true })
  }

  async function changePassword() {
    if (pw.length < 8) return toast(t("auth.pwTooShort"), { error: true })
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return toast(error.message, { error: true })
    setPw("")
    toast(t("auth.pwUpdated"))
  }

  async function sendIgem() {
    const { error } = await supabase.from("posts").insert({ author_id: me.id, station_id: me.station_id, kind: "igem", content: motivation.trim() })
    if (error) return toast(t("common.error"), { error: true })
    setIgem(false)
    setMotivation("")
    void qc.invalidateQueries({ queryKey: qk.feed })
    toast(t("settings.igemSent"))
  }

  async function logout() {
    await unlinkNativeDevice()
    await supabase.auth.signOut()
    try { localStorage.removeItem("ysa-cache") } catch {}
    router.replace("/auth/login")
    router.refresh()
  }

  async function deleteAccount() {
    if (prompt(t("settings.deleteConfirm")) !== "DELETE") return
    const res = await fetch("/api/account/delete", { method: "POST" })
    if (!res.ok) return toast(t("settings.deleteError"), { error: true })
    await logout()
  }

  return (
    <div className="flex flex-col px-4 pt-4">
      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <button onClick={() => fileRef.current?.click()} className="relative" aria-label={t("settings.changePhoto")}>
          <Avatar name={me.full_name} photoUrl={me.photo_url} stationId={me.station_id} size={96} className={cn(uploading && "opacity-50")} />
          <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card"><Camera className="size-4" /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={changePhoto} />
        <p className="mt-1 font-heading text-lg font-bold text-foreground">{me.full_name}</p>
        <p className="text-sm text-muted-foreground">{me.position ?? t("profile.member")} · {me.email}</p>
        <StationBadge id={me.station_id} member />
      </Card>

      <div className="mt-4"><PointsCard userId={me.id} /></div>


      <SectionTitle><span className="flex items-center gap-1.5"><UserRound className="size-3.5" /> {t("settings.profileInfo")}</span></SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("profile.firstName")}><Input value={me.first_name} disabled readOnly /></Field>
          <Field label={t("profile.lastName")}><Input value={me.last_name} disabled readOnly /></Field>
          <Field label={t("profile.phone")}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+33 6 …" /></Field>
          <Field label={t("profile.birthday")}><Input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} className="px-3" /></Field>
          <Field label={t("profile.hometown")}>
            <Select value={f.hometown} onChange={(e) => setF({ ...f, hometown: e.target.value })}>
              <option value="">{t("auth.pickHometown")}</option>
              {HOMETOWNS.map((h) => <option key={h}>{h}</option>)}
            </Select>
          </Field>
          <Field label="LinkedIn"><Input value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.stationLocked")}</p>
        <Button onClick={save} loading={saving}>{t("common.save")}</Button>
      </Card>

      <SectionTitle><span className="flex items-center gap-1.5"><Bell className="size-3.5" /> {t("settings.notifications")}</span></SectionTitle>
      <Card className="flex flex-col gap-2">
        {hydrated && pushSupported() && <Toggle checked={push} onChange={togglePush} label={<span className="flex items-center gap-2"><BellRing className="size-4 text-primary" /> {t("settings.pushNotif")}</span>} />}
        {(["messages", "tasks", "events", "members"] as const).map((k) => (
          <Toggle key={k} checked={me.notif_prefs?.[k] ?? true} onChange={(v) => setPref(k, v)} label={t(`settings.pref.${k}`)} />
        ))}
      </Card>

      <SectionTitle><span className="flex items-center gap-1.5"><GraduationCap className="size-3.5" /> iGEM</span></SectionTitle>
      <Card className="flex items-center gap-3">
        <p className="flex-1 text-sm text-foreground">{t("settings.igemDesc")}</p>
        <Button variant="secondary" size="sm" onClick={() => setIgem(true)}>{t("settings.igemRequestBtn")}</Button>
      </Card>

      <SectionTitle><span className="flex items-center gap-1.5"><Palette className="size-3.5" /> {t("settings.palette")}</span></SectionTitle>
      <Card className="grid grid-cols-5 gap-2 p-3">
        {PALETTES.map((p) => {
          const active = palette === p.id
          return (
            <button key={p.id} onClick={() => setPalette(p.id)} className="flex flex-col items-center gap-1.5" aria-pressed={active}>
              <span
                className={cn("relative flex size-12 items-center justify-center rounded-2xl border-2 transition-transform", active ? "scale-105 border-foreground/80" : "border-border")}
                style={{ backgroundColor: p.bg }}
              >
                <span className="size-6 rounded-full shadow-sm" style={{ backgroundColor: p.swatch }} />
                {active && <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"><Check className="size-3" strokeWidth={3} /></span>}
              </span>
              <span className={cn("text-[10.5px] font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{p.name}</span>
            </button>
          )
        })}
      </Card>

      <SectionTitle><span className="flex items-center gap-1.5"><KeyRound className="size-3.5" /> {t("settings.account")}</span></SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("auth.newPassword")} autoComplete="new-password" />
          <Button variant="secondary" onClick={changePassword} disabled={!pw}>{t("common.save")}</Button>
        </div>
        <Button variant="outline" onClick={logout}><LogOut className="size-4" /> {t("settings.logout")}</Button>
        <Button variant="ghost" onClick={deleteAccount} className="text-destructive"><Trash2 className="size-4" /> {t("settings.deleteAccount")}</Button>
      </Card>
      <div className="mb-4 mt-6 flex flex-col items-center gap-1.5 text-center text-[11px] text-muted-foreground/60">
        <p><span className="font-medium text-muted-foreground/80">Onur Arslan</span> tarafından geliştirilmiştir.</p>
        <p>Bilgi için <a href="mailto:secretaire@youthstation.org" className="underline underline-offset-2 hover:text-primary">secretaire@youthstation.org</a></p>
        <p className="flex gap-3">
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">{t("legal.privacy")}</a>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">{t("legal.terms")}</a>
        </p>
        <p>{t("settings.version")}</p>
        {/* 🔐 VIP only (secretaire@ / president@): discreet gold lock to the Yönetici panel */}
        {isAdmin(me) && (
          <Link href="/yonetici" aria-label="Yönetici" title="Yönetici" className="mt-1 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-white shadow-md shadow-amber-500/30 transition-transform active:scale-90">
            <Lock className="size-4" strokeWidth={2.4} />
          </Link>
        )}
      </div>

      <Sheet open={igem} onClose={() => setIgem(false)} title={t("feed.igem")} footer={<Button className="w-full" size="lg" onClick={sendIgem}>{t("common.send")}</Button>}>
        <Field label={t("settings.igemMotivation")}><Textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder={t("settings.igemMotivationPlaceholder")} className="min-h-32" /></Field>
      </Sheet>
    </div>
  )
}
