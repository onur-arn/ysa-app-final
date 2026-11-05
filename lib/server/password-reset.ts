import "server-only"
import { createHash, randomInt, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/server"
import { esc, mailConfigured, sendMail } from "./mailer"

const TTL_MS = 15 * 60_000
const MAX_ATTEMPTS = 5
const hash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex")
const norm = (email: string) => email.trim().toLowerCase()

/** Sends the 6-digit code through Brevo, as in ysa-application. Silent for unknown e-mails. */
export async function requestPasswordReset(rawEmail: string): Promise<"sent" | "unknown" | "not_configured"> {
  if (!mailConfigured()) return "not_configured"
  const email = norm(rawEmail)
  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("id, first_name").eq("email", email).maybeSingle()
  if (!profile) return "unknown"

  const code = randomInt(100000, 1000000).toString()
  await admin.from("password_resets").upsert({ email, code_hash: hash(email, code), expires_at: new Date(Date.now() + TTL_MS).toISOString(), attempts: 0 })

  await sendMail({
    to: email,
    subject: "YouthStation — Şifre sıfırlama kodunuz",
    html: `
      <div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;color:#374151">
        <h2 style="color:#111827;font-size:20px;margin:0 0 16px">Şifre sıfırlama</h2>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Merhaba ${esc(profile.first_name)},<br>YouthStation için şifre sıfırlama talebinde bulundunuz.</p>
        <p style="font-size:14px;margin:0 0 8px">Doğrulama kodunuz:</p>
        <div style="display:inline-block;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:12px;padding:14px 28px;margin-bottom:12px">
          <span style="font-size:30px;font-weight:700;letter-spacing:0.2em;color:#111827;font-family:monospace">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin:0 0 24px">Bu kod <strong>15 dakika</strong> geçerlidir.</p>
        <p style="color:#9ca3af;font-size:12px;margin:0">Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.</p>
      </div>`,
  })
  return "sent"
}

/** Checks the code (hashed, 15 min, 5 attempts) and sets the new password with the service role. */
export async function resetPassword(rawEmail: string, code: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = norm(rawEmail)
  if (password.length < 8) return { ok: false, error: "Şifre en az 8 karakter olmalı." }
  const admin = createAdminClient()
  const { data: row } = await admin.from("password_resets").select("*").eq("email", email).maybeSingle()
  if (!row || new Date(row.expires_at) < new Date()) return { ok: false, error: "Kodun süresi dolmuş. Lütfen yeni bir kod isteyin." }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Çok fazla hatalı deneme. Lütfen yeni bir kod isteyin." }

  const expected = Buffer.from(row.code_hash)
  const given = Buffer.from(hash(email, code.trim()))
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await admin.from("password_resets").update({ attempts: row.attempts + 1 }).eq("email", email)
    return { ok: false, error: `Kod hatalı (${MAX_ATTEMPTS - row.attempts - 1} deneme hakkı kaldı).` }
  }

  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (!profile) return { ok: false, error: "Hesap bulunamadı." }
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) return { ok: false, error: "Şifre güncellenemedi. Lütfen tekrar deneyin." }
  await admin.from("password_resets").delete().eq("email", email)
  return { ok: true }
}
