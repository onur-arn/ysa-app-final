import "server-only"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Pushes the notifications created by the database triggers that were not pushed yet.
 * Content and recipients always come from the notifications table.
 */
export async function deliverPendingPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_SERVICE_ROLE_KEY) return 0
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:contact@youthstation.org", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const admin = createAdminClient()
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: pending } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, link, count")
    .is("pushed_at", null)
    .is("read_at", null)
    .gte("created_at", since)
    .limit(200)
  if (!pending?.length) return 0

  // Claim the rows first so concurrent flushes never push twice.
  const { data: claimed } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .in("id", pending.map((n) => n.id))
    .is("pushed_at", null)
    .select("id")
  const ids = new Set((claimed ?? []).map((c) => c.id))
  const toSend = pending.filter((n) => ids.has(n.id))
  if (!toSend.length) return 0

  const { data: subs } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", [...new Set(toSend.map((n) => n.user_id))])
  let sent = 0
  await Promise.all(
    toSend.flatMap((n) =>
      (subs ?? [])
        .filter((s) => s.user_id === n.user_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.count > 1 ? `${n.title} (${n.count})` : n.title, body: n.body, url: n.link ?? "/feed", tag: n.type === "message" ? n.link : n.id }),
            )
            sent++
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint)
          }
        }),
    ),
  )
  return sent
}
