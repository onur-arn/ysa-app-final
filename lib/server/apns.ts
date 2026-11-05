import "server-only"
import { createPrivateKey, sign } from "node:crypto"
import http2 from "node:http2"

/**
 * Apple Push Notification service, for the iOS app (a WebView has no Web Push).
 * Needs an APNs key from Apple Developer → Keys. TestFlight and App Store builds both
 * use the production host; set APNS_ENV=sandbox only for a build run from Xcode.
 */
export type ApnsMessage = { token: string; title: string; body?: string | null; url: string; threadId?: string | null }

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url")
let cached: { jwt: string; at: number } | null = null

export const apnsConfigured = () => !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY)

/** Apple rejects tokens older than an hour and refreshing more than every 20 minutes. */
function providerToken() {
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.jwt
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY } = process.env
  const head = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const key = createPrivateKey(APNS_PRIVATE_KEY!.replace(/\\n/g, "\n"))
  const signature = sign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" })
  cached = { jwt: `${head}.${claims}.${b64url(signature)}`, at: Date.now() }
  return cached.jwt
}

function send(client: http2.ClientHttp2Session, jwt: string, m: ApnsMessage) {
  return new Promise<{ status: number; reason?: string }>((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${m.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APNS_BUNDLE_ID || "org.youthstation.ysa",
      "apns-push-type": "alert",
      "apns-priority": "10",
    })
    let status = 0
    let data = ""
    req.setEncoding("utf8")
    req.setTimeout(8000, () => req.close(http2.constants.NGHTTP2_CANCEL))
    req.on("response", (h) => { status = Number(h[":status"]) })
    req.on("data", (c) => { data += c })
    req.on("error", () => resolve({ status: 0 }))
    req.on("close", () => {
      let reason: string | undefined
      try { reason = (JSON.parse(data) as { reason?: string }).reason } catch {}
      resolve({ status, reason })
    })
    req.end(JSON.stringify({
      aps: { alert: { title: m.title, body: m.body ?? "" }, sound: "default", ...(m.threadId ? { "thread-id": m.threadId } : {}) },
      url: m.url,
    }))
  })
}

/** Sends everything over one connection. Returns what was delivered and the tokens Apple retired. */
export async function sendApns(messages: ApnsMessage[]) {
  if (!messages.length || !apnsConfigured()) return { sent: 0, dead: [] as string[] }
  const host = process.env.APNS_ENV === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com"
  const client = http2.connect(host)
  client.on("error", () => {})
  const jwt = providerToken()
  const results = await Promise.all(messages.map(async (m) => ({ token: m.token, ...(await send(client, jwt, m)) })))
  client.close()
  return {
    sent: results.filter((r) => r.status === 200).length,
    dead: results.filter((r) => r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered").map((r) => r.token),
  }
}
