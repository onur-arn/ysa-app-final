import { redirect } from "next/navigation"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/types"

/** Current user's profile (cached per request). Redirects when signed out / not yet approved. */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
  if (!profile) redirect("/auth/pending?missing=1")
  if (profile.status !== "active") redirect("/auth/pending")
  return profile as Profile
})
