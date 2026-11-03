import "server-only"
import { createHmac, timingSafeEqual } from "crypto"

// Dedicated secret if provided, otherwise derived from the service key (never sent to clients).
const secret = () => process.env.SIGNUP_TOKEN_SECRET || `ysa-signup:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url")

const TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Signed, tamper-proof token for the Kabul et / Reddet links; expires after 7 days. */
export function signDecision(userId: string, action: "approve" | "reject") {
  const data = Buffer.from(JSON.stringify({ u: userId, a: action, e: Date.now() + TTL_MS })).toString("base64url")
  return `${data}.${sign(data)}`
}

export function verifyDecision(token: string): { userId: string; action: "approve" | "reject" } | null {
  const [data, sig] = token.split(".")
  if (!data || !sig) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { u, a, e } = JSON.parse(Buffer.from(data, "base64url").toString())
    if (typeof e !== "number" || e < Date.now()) return null
    return typeof u === "string" && (a === "approve" || a === "reject") ? { userId: u, action: a } : null
  } catch {
    return null
  }
}
