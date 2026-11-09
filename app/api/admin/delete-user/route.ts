import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"

type Admin = ReturnType<typeof createAdminClient>

/** Every object under `prefix` in a bucket (folders are walked recursively). */
async function listAll(admin: Admin, bucket: string, prefix: string): Promise<string[]> {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  const paths: string[] = []
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`
    if (item.id) paths.push(path)                          // a file
    else paths.push(...(await listAll(admin, bucket, path)))  // a folder
  }
  return paths
}

/**
 * Admins erase an account for good: the person disappears from everywhere in the app.
 * Their direct conversations, messages, notifications they caused and uploaded media are
 * removed first; deleting the auth user then cascades to the profile and everything
 * else they authored (posts, comments, stories, likes, votes, task comments, blocks…).
 * Events and tasks they created stay, without them as creator or assignee.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: allowed } = await supabase.rpc("is_intl")   // Uluslararası Büro or VIP admin
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string }
  if (!userId || userId === user.id) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from("profiles").select("app_role, photo_url").eq("id", userId).maybeSingle()
  if (target?.app_role === "admin") return NextResponse.json({ error: "protected_account" }, { status: 403 })

  // 1. direct conversations with this person vanish for the other side too
  const { data: memberships } = await admin.from("conversation_members").select("conversation_id").eq("user_id", userId)
  const convIds = (memberships ?? []).map((m) => m.conversation_id)
  if (convIds.length) {
    const { error } = await admin.from("conversations").delete().in("id", convIds).eq("type", "dm")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. what would otherwise survive the cascade with a blank author
  for (const [table, column] of [["messages", "sender_id"], ["notifications", "actor_id"]] as const) {
    const { error } = await admin.from(table).delete().eq(column, userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await admin.from("reports").delete().eq("kind", "user").eq("target_id", userId)

  // 3. uploaded media (photos, stories, voice notes) and the sign-up photo
  const media = await listAll(admin, "media", userId)
  const signupPhoto = target?.photo_url?.match(/\/media\/(signup\/[^?]+)/)?.[1]
  if (signupPhoto) media.push(signupPhoto)
  for (let i = 0; i < media.length; i += 100) await admin.storage.from("media").remove(media.slice(i, i + 100))

  // 4. the account itself: cascades to the profile and all their remaining content
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
