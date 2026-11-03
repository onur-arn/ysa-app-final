import { NextResponse, type NextRequest } from "next/server"
import { requestPasswordReset } from "@/lib/server/password-reset"

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  try {
    const res = await requestPasswordReset(email)
    if (res === "not_configured") return NextResponse.json({ error: "mail_not_configured" }, { status: 503 })
    // same answer for known and unknown addresses: the form never reveals who is a member
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[password/forgot]", e)
    return NextResponse.json({ error: "send_failed" }, { status: 502 })
  }
}
