import { NextResponse, type NextRequest } from "next/server"
import { decideSignup } from "@/lib/server/signups"
import { createClient } from "@/lib/supabase/server"

/** Yönetici panel: approve or reject a sign-up (VIP admins only). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: allowed } = await supabase.rpc("is_admin")
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { userId, decision } = (await req.json().catch(() => ({}))) as { userId?: string; decision?: "approve" | "reject" }
  if (!userId || (decision !== "approve" && decision !== "reject")) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  const res = await decideSignup(userId, decision)
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.reason }, { status: 409 })
}
