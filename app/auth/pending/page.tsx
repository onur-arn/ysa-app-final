import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PendingView } from "./pending-view"

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("status, first_name").eq("id", user.id).maybeSingle()
  if (profile?.status === "active") redirect("/feed")
  return <PendingView status={profile?.status ?? "pending"} firstName={profile?.first_name ?? ""} />
}
