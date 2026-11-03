import { NextResponse } from "next/server"
import { deliverPendingPush } from "@/lib/server/push"
import { createClient } from "@/lib/supabase/server"

/** Any signed-in member may trigger a flush; content and recipients come from the database. */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json({ sent: await deliverPendingPush() })
}
