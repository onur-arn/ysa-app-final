import { NextRequest, NextResponse } from "next/server"
import { limited } from "@/lib/server/rate-limit"

/**
 * Deezer preview links expire after ~15 minutes but a story lives 24 h, so stories
 * store this route with the track id and every play is redirected to a fresh link.
 */
export async function GET(req: NextRequest) {
  // Browsers issue several range requests per play.
  const rl = limited(req, "deezer-preview", 240, 60000); if (rl) return rl
  const id = req.nextUrl.searchParams.get("id")?.trim()
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`, { next: { revalidate: 300 } })
    const { preview } = await res.json()
    if (!preview) return NextResponse.json({ error: "No preview" }, { status: 404 })
    return NextResponse.redirect(preview, { status: 302, headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
