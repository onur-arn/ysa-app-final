import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { buildWelcomePost } from "@/lib/welcome-post"
import { ADMIN_TO, esc, mailConfigured, sendMail } from "./mailer"
import { deliverPendingPush } from "./push"
import { signDecision } from "./signup-token"

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000"

type Pending = {
  id: string; full_name: string; first_name: string; email: string; phone: string | null; birthday: string | null; linkedin: string | null
  hometown: string | null; station_id: string | null; position: string | null; igem_trained: boolean; igem_date: string | null
  photo_url: string | null; status: string; created_at: string; signup_notified_at: string | null
}

/** E-mail to the secretariat with the applicant's card and Kabul et / Reddet buttons (as in ysa-application). */
export async function notifyAdminsOfSignup(email: string) {
  const admin = createAdminClient()
  const { data: p } = await admin.from("profiles").select("*").eq("email", email.trim().toLowerCase()).maybeSingle<Pending>()
  // only once, only for a fresh pending sign-up — the endpoint cannot be used to spam
  if (!p || p.status !== "pending" || p.signup_notified_at || Date.now() - new Date(p.created_at).getTime() > 30 * 60_000) return false
  if (!mailConfigured()) return false
  const { data: st } = await admin.from("stations").select("name").eq("id", p.station_id ?? "").maybeSingle()

  const approve = `${SITE()}/api/signup-decision?token=${signDecision(p.id, "approve")}`
  const reject = `${SITE()}/api/signup-decision?token=${signDecision(p.id, "reject")}`
  const row = (label: string, value: string | null | undefined) =>
    `<tr><td style="padding:7px 14px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6">${label}</td><td style="padding:7px 14px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${esc(value) || "—"}</td></tr>`

  await sendMail({
    to: ADMIN_TO,
    subject: `[YSA] Yeni üyelik talebi — ${p.full_name}`,
    html: `
      <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <div style="background:#67A2B2;padding:20px 24px">
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Yeni üyelik talebi</h1>
          <p style="margin:4px 0 0;color:#eef7fa;font-size:13px">Onayınızı bekliyor</p>
        </div>
        <div style="padding:24px">
          ${p.photo_url ? `<div style="text-align:center;margin-bottom:16px"><img src="${esc(p.photo_url)}" alt="" width="88" height="88" style="border-radius:50%;object-fit:cover"></div>` : ""}
          <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px">
            ${row("Ad Soyad", p.full_name)}
            ${row("E-posta", p.email)}
            ${row("Telefon", p.phone)}
            ${row("Doğum tarihi", p.birthday)}
            ${row("LinkedIn", p.linkedin)}
            ${row("Görev", p.position ?? "Üye")}
            ${row("İstasyon", st?.name ?? p.station_id)}
            ${row("Memleket", p.hometown)}
            ${row("iGEM Eğitimi", p.igem_trained ? `✅ Evet${p.igem_date ? ` — ${p.igem_date}` : ""}` : "❌ Hayır")}
          </table>
          <div style="text-align:center">
            <a href="${approve}" style="display:inline-block;margin:0 6px;padding:12px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none">✅ Kabul et</a>
            <a href="${reject}" style="display:inline-block;margin:0 6px;padding:12px 32px;background:#dc2626;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none">❌ Reddet</a>
          </div>
          <p style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center">Bağlantılar tek kullanımlıktır. Talebi uygulamadaki Yönetici panelinden de yönetebilirsiniz.</p>
        </div>
      </div>`,
  })
  await admin.from("profiles").update({ signup_notified_at: new Date().toISOString() }).eq("id", p.id)
  return true
}

/**
 * Approve or reject a pending sign-up — used by the Yönetici panel and by the e-mail buttons.
 * Approval publishes the welcome card on the feed, e-mails the member and pushes the "new member" alerts.
 */
export async function decideSignup(userId: string, decision: "approve" | "reject") {
  const admin = createAdminClient()
  const { data: p } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle<Pending>()
  if (!p) return { ok: false as const, reason: "not_found" as const }
  if (p.status !== "pending") return { ok: false as const, reason: "already_decided" as const, status: p.status, name: p.full_name }

  if (decision === "reject") {
    await admin.from("profiles").update({ status: "rejected" }).eq("id", userId)
    return { ok: true as const, name: p.full_name }
  }

  await admin.from("profiles").update({ status: "active", approved_at: new Date().toISOString() }).eq("id", userId)
  const welcome = buildWelcomePost(p.full_name, p.hometown, p.station_id ?? "intl")
  await admin.from("posts").insert({ author_id: null, kind: "welcome", station_id: p.station_id, content: welcome.content })

  let mailed = false
  if (mailConfigured()) {
    try {
      await sendMail({
        to: p.email,
        subject: "YSA Uygulaması — Üyeliğiniz onaylandı 🎉",
        html: `
          <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
            <div style="background:#67A2B2;padding:20px 24px"><h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Üyeliğiniz onaylandı!</h1></div>
            <div style="padding:24px">
              <p style="font-size:14px;color:#374151">Merhaba <strong>${esc(p.first_name)}</strong>,</p>
              <p style="font-size:14px;color:#374151">YouthStation uygulamasına üyeliğiniz onaylandı. Kayıt sırasında belirlediğiniz şifrenizle giriş yapabilirsiniz.</p>
              <a href="${SITE()}/auth/login" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#67A2B2;color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none">Giriş yap →</a>
            </div>
          </div>`,
      })
      mailed = true
    } catch (e) {
      console.error("[signup] welcome e-mail failed:", e)
    }
  }
  await deliverPendingPush().catch(() => 0)
  return { ok: true as const, name: p.full_name, mailed }
}
