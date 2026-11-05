import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const PUBLIC_PATHS = ["/auth", "/setup", "/manifest.json", "/gizlilik", "/kosullar"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Without Supabase keys nothing can work: show the setup guide instead of crashing.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup" || pathname === "/manifest.json") return response
    return NextResponse.redirect(new URL("/setup", request.url))
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const isApi = pathname.startsWith("/api")

  if (!user && !isPublic && !isApi) {
    const to = request.nextUrl.clone()
    to.pathname = "/auth/login"
    to.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(to)
  }

  // Signed-in users skip the login / sign-up screens (but may still reset a password or see "pending").
  if (user && (pathname === "/auth/login" || pathname === "/auth/sign-up" || pathname === "/")) {
    const to = request.nextUrl.clone()
    to.pathname = "/feed"
    to.search = ""
    return NextResponse.redirect(to)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
