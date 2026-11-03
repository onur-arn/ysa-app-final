import { NextResponse, type NextRequest } from "next/server"
import { notifyAdminsOfSignup } from "@/lib/server/signups"

/** Called by the sign-up form once the account exists: e-mails the secretariat (once per sign-up). */
export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string }
  if (!email) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  try {
    return NextResponse.json({ sent: await notifyAdminsOfSignup(email) })
  } catch (e) {
    console.error("[signup-notify]", e)
    return NextResponse.json({ sent: false })
  }
}
