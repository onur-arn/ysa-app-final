import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { buildWelcomePost } from "@/lib/welcome-post"

/** Approve or reject a sign-up. Approval also publishes the welcome card on the feed. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: allowed } = await supabase.rpc("is_admin")
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { userId, decision } = (await req.json().catch(() => ({}))) as { userId?: string; decision?: "approve" | "reject" }
  if (!userId || (decision !== "approve" && decision !== "reject")) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("full_name, first_name, hometown, station_id, status").eq("id", userId).single()
  if (!profile || profile.status !== "pending") return NextResponse.json({ error: "not_pending" }, { status: 409 })

  if (decision === "reject") {
    await admin.from("profiles").update({ status: "rejected" }).eq("id", userId)
    return NextResponse.json({ ok: true })
  }

  // Updating as the admin (not service role) keeps the audit of who approved, and fires the "new member" notifications.
  const { error } = await supabase.from("profiles").update({ status: "active", approved_at: new Date().toISOString() }).eq("id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const welcome = buildWelcomePost(profile.full_name, profile.hometown, profile.station_id ?? "intl")
  await admin.from("posts").insert({ author_id: null, kind: "welcome", station_id: profile.station_id, content: welcome.content })
  return NextResponse.json({ ok: true })
}
