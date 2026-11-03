import { NextResponse, type NextRequest } from "next/server"
import { notifyAdminsOfSignup } from "@/lib/server/signups"
import { createAdminClient } from "@/lib/supabase/server"

type Body = Record<string, string | boolean | null | undefined>
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/**
 * Creates the account server-side, already e-mail-confirmed (as ysa-application did):
 * no Supabase e-mail is needed — the secretariat's "Kabul et" is the real check.
 * The profile starts "pending" and the secretariat is e-mailed right away.
 */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Body
  const email = str(b.email).toLowerCase()
  const password = typeof b.password === "string" ? b.password : ""
  const photo = str(b.photo_url, 500)
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 })
  if (!str(b.first_name) || !str(b.last_name) || !str(b.station_id)) return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  if (!photo.includes("/storage/v1/object/public/media/signup/")) return NextResponse.json({ error: "photo_required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: str(b.first_name, 60), last_name: str(b.last_name, 60), phone: str(b.phone, 40), birthday: str(b.birthday, 10),
      linkedin: str(b.linkedin, 300), station_id: str(b.station_id, 40), position: str(b.position, 100) || null, hometown: str(b.hometown, 60),
      igem_trained: b.igem_trained === true, igem_date: str(b.igem_date, 10), photo_url: photo,
    },
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) return NextResponse.json({ error: "email_taken" }, { status: 409 })
    if (msg.includes("database")) return NextResponse.json({ error: "position_taken" }, { status: 409 })
    console.error("[signup]", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }

  await notifyAdminsOfSignup(email).catch((e) => console.error("[signup] admin e-mail failed:", e))
  return NextResponse.json({ ok: true })
}
