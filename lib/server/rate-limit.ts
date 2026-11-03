import "server-only"

/**
 * Tiny in-memory fixed-window rate limiter for the public (unauthenticated) API
 * routes. Zero-dependency and good enough to blunt bursts, brute force and quota
 * abuse. Note: memory is per server instance, so on a multi-instance/serverless
 * deployment it throttles per instance — pair it with a shared store (e.g. Upstash)
 * for strict global limits.
 */
type Bucket = { count: number; reset: number }
const buckets = new Map<string, Bucket>()

// keep the map from growing forever
let lastSweep = 0
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k)
}

/** Returns { ok, retryAfter } — retryAfter is seconds until the window resets. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key)
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  b.count++
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) }
  return { ok: true, retryAfter: 0 }
}

/** Best-effort client IP from the proxy headers (Vercel/other) — falls back to a shared bucket. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

/** Convenience: enforce a limit for (routeTag, ip); returns a 429 Response when exceeded, else null. */
export function limited(req: Request, tag: string, limit: number, windowMs: number): Response | null {
  const { ok, retryAfter } = rateLimit(`${tag}:${clientIp(req)}`, limit, windowMs)
  if (ok) return null
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  })
}
