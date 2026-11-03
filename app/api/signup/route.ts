import { NextResponse, type NextRequest } from "next/server"
import { notifyAdminsOfSignup } from "@/lib/server/signups"
import { createAdminClient } from "@/lib/supabase/server"
import { limited } from "@/lib/server/rate-limit"

type Body = Record<string, string | boolean | null | undefined>
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/**
 * Creates the account server-side, already e-mail-confirmed (as ysa-application did):
 * no Supabase e-mail is needed — the secretariat's "Kabul et" is the real check.
 * The profile starts "pending" and the secretariat is e-mailed right away.
 */
export async function POST(req: NextRequest) {
  const rl = limited(req, "signup", 5, 60 * 60 * 1000); if (rl) return rl
  const b = (await req.json().catch(() => ({}))) as Body
  const email = str(b.email).toLowerCase()
  const password = typeof b.password === "string" ? b.password : ""
  const photo = str(b.photo_url, 500)
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 })
  const guest = b.guest === true
  // contact details are mandatory (LinkedIn is the only optional field)
  if (str(b.phone).replace(/\D/g, "").length < 8 || !/^\d{4}-\d{2}-\d{2}$/.test(str(b.birthday, 10))) return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  // a station member must pick a station and a görev; a guest ("Misafir giriş") has neither
  if (!str(b.first_name) || !str(b.last_name) || (!guest && (!str(b.station_id) || !str(b.position)))) return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  if (!photo.includes("/storage/v1/object/public/media/signup/")) return NextResponse.json({ error: "photo_required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: str(b.first_name, 60), last_name: str(b.last_name, 60), phone: str(b.phone, 40), birthday: str(b.birthday, 10),
      linkedin: str(b.linkedin, 300), guest, station_id: guest ? "" : str(b.station_id, 40), position: guest ? null : str(b.position, 100), hometown: str(b.hometown, 60),
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

/** Step 1 check: tells the form right away that an address is already registered. */
export async function GET(req: NextRequest) {
  const rl = limited(req, "signup-check", 20, 10 * 60 * 1000); if (rl) return rl
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ taken: false })
  const { data } = await createAdminClient().from("profiles").select("id").eq("email", email).limit(1)
  return NextResponse.json({ taken: !!data?.length })
}
