import { NextResponse, type NextRequest } from "next/server"
import { resetPassword } from "@/lib/server/password-reset"

export async function POST(req: NextRequest) {
  const { email, code, password } = (await req.json().catch(() => ({}))) as { email?: string; code?: string; password?: string }
  if (!email || !code || !password) return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 })
  const res = await resetPassword(email, code, password)
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 400 })
}
