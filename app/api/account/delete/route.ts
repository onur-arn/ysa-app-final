import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

/** A member deletes their own account (profile rows cascade from auth.users). */
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

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
