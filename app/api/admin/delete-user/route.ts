import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

/** Admins permanently remove an account (e.g. a rejected sign-up or GDPR request). */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string }
  if (!userId || userId === user.id) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const { error } = await createAdminClient().auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
