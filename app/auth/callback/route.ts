import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Handles e-mail confirmation and password-recovery links (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/feed"
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/feed", origin))
}
