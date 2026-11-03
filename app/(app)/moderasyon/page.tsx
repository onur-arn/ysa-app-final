import { redirect } from "next/navigation"
import { requireProfile } from "@/lib/auth"
import { canModerate } from "@/lib/permissions"
import { ModerationClient } from "./moderation-client"

export const metadata = { title: "Moderasyon" }

export default async function ModerationPage() {
  const me = await requireProfile()
  if (!canModerate(me)) redirect("/feed")
  return <ModerationClient />
}
