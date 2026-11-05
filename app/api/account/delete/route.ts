import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

/**
 * A member deletes their own account. Their name stays, struck through, on the content
 * they leave behind; everything else that identifies them is erased: contact details,
 * photo, e-mail, push devices. See /gizlilik, which promises exactly this.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("app_role", "admin").eq("status", "active")
  const { data: me } = await admin.from("profiles").select("app_role, photo_url").eq("id", user.id).single()
  if (me?.app_role === "admin" && (count ?? 0) <= 1) {
    return NextResponse.json({ error: "last_admin" }, { status: 409 })
  }

  // soft-delete: keep the name, free the görev slot, erase the rest, block login for good
  const { error } = await admin.from("profiles").update({
    status: "deleted", position: null, last_seen_at: null,
    email: "", phone: null, birthday: null, linkedin: null, hometown: null, photo_url: null,
  }).eq("id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.all([
    admin.from("device_tokens").delete().eq("user_id", user.id),
    admin.from("push_subscriptions").delete().eq("user_id", user.id),
  ])
  const photo = me?.photo_url?.split("/storage/v1/object/public/media/")[1]?.split("?")[0]
  if (photo) await admin.storage.from("media").remove([decodeURIComponent(photo)])
  await admin.auth.admin.updateUserById(user.id, {
    email: `deleted-${user.id}@deleted.invalid`,
    email_confirm: true,
    user_metadata: {},
    ban_duration: "876000h",
  })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
