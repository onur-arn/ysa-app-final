import { NextRequest, NextResponse } from "next/server"
import { limited } from "@/lib/server/rate-limit"

export async function GET(req: NextRequest) {
  const rl = limited(req, "deezer-search", 30, 60000); if (rl) return rl
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ data: [] })

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20&output=json`,
      { next: { revalidate: 60 } },
    )
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ data: [] }, { status: 502 })
  }
}
