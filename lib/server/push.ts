import "server-only"
import webpush from "web-push"
import { apnsConfigured, sendApns, type ApnsMessage } from "@/lib/server/apns"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Pushes the notifications created by the database triggers that were not pushed yet.
 * Content and recipients always come from the notifications table.
 */
export async function deliverPendingPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const webPush = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
  if (!SUPABASE_SERVICE_ROLE_KEY || (!webPush && !apnsConfigured())) return 0
  if (webPush) webpush.setVapidDetails(VAPID_SUBJECT || "mailto:contact@youthstation.org", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
  const admin = createAdminClient()
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: pending } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, link, count")
    .is("pushed_at", null)
    .is("read_at", null)
    .gte("created_at", since)
    .limit(1000)   // a new feed post notifies every member at once
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

  const userIds = [...new Set(toSend.map((n) => n.user_id))]
  // Pas de compteur « (2) », « (3) » dans le titre : une notification par message suffit.
  const titleOf = (n: (typeof toSend)[number]) => n.title
  // The database keeps the first 140 characters of a message: when it was cut, end on a whole
  // word with "…", like other messaging apps.
  const BODY_LIMIT = 140
  const bodyOf = (n: (typeof toSend)[number]) => {
    const body = n.body ?? ""
    if (body.length < BODY_LIMIT) return n.body
    const cut = body.slice(0, BODY_LIMIT - 1).replace(/\s+\S*$/, "").trimEnd()
    return `${cut || body.slice(0, BODY_LIMIT - 1)}…`
  }
  const tagOf = (n: (typeof toSend)[number]) => (n.type === "message" ? n.link : n.id)

  const { data: devices } = await admin.from("device_tokens").select("token, user_id").in("user_id", userIds)
  const native: ApnsMessage[] = toSend.flatMap((n) =>
    (devices ?? [])
      .filter((d) => d.user_id === n.user_id)
      .map((d) => ({ token: d.token, title: titleOf(n), body: bodyOf(n), url: n.link ?? "/feed", threadId: tagOf(n) })),
  )
  const apns = await sendApns(native)
  if (apns.dead.length) await admin.from("device_tokens").delete().in("token", apns.dead)
  if (!webPush) return apns.sent

  const { data: subs } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", userIds)
  let sent = apns.sent
  await Promise.all(
    toSend.flatMap((n) =>
      (subs ?? [])
        .filter((s) => s.user_id === n.user_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: titleOf(n), body: bodyOf(n), url: n.link ?? "/feed", tag: tagOf(n) }),
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
