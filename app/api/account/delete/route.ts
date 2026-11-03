import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

/**
 * A member deletes their own account. We keep the profile (name shown struck-through
 * everywhere their content remains) but mark it deleted and block any future login.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("app_role", "admin").eq("status", "active")
  const { data: me } = await admin.from("profiles").select("app_role").eq("id", user.id).single()
  if (me?.app_role === "admin" && (count ?? 0) <= 1) {
    return NextResponse.json({ error: "last_admin" }, { status: 409 })
  }

  // soft-delete: keep the name, free the görev slot, block login for good
  await admin.from("profiles").update({ status: "deleted", position: null, last_seen_at: null }).eq("id", user.id)
  await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
