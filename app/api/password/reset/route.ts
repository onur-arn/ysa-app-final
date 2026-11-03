import { NextResponse, type NextRequest } from "next/server"
import { resetPassword } from "@/lib/server/password-reset"
import { limited } from "@/lib/server/rate-limit"

export async function POST(req: NextRequest) {
  const rl = limited(req, "pw-reset", 10, 900000); if (rl) return rl
  const { email, code, password } = (await req.json().catch(() => ({}))) as { email?: string; code?: string; password?: string }
  if (!email || !code || !password) return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 })
  const res = await resetPassword(email, code, password)
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 400 })
}
