import { NextResponse, type NextRequest } from "next/server"
import { requestPasswordReset } from "@/lib/server/password-reset"
import { limited, rateLimit } from "@/lib/server/rate-limit"

export async function POST(req: NextRequest) {
  const rl = limited(req, "pw-forgot", 5, 900000); if (rl) return rl
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  // also cap per address so a victim cannot be spammed from rotating IPs (same silent ok)
  if (!rateLimit(`pw-forgot-email:${email.toLowerCase()}`, 3, 900000).ok) return NextResponse.json({ ok: true })
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
