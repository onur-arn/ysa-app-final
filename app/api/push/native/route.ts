import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

const validToken = (t: unknown): t is string => typeof t === "string" && /^[0-9a-fA-F]{32,200}$/.test(t)

/** Links this iPhone's APNs token to the signed-in member (and away from any previous one). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown }
  if (!validToken(token)) return NextResponse.json({ error: "bad_request" }, { status: 400 })
  const { error } = await createAdminClient().from("device_tokens").upsert({ token, user_id: user.id }, { onConflict: "token" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown }
  if (validToken(token)) await createAdminClient().from("device_tokens").delete().eq("user_id", user.id).eq("token", token)
  return NextResponse.json({ ok: true })
}
