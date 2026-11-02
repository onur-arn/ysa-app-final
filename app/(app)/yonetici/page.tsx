import { redirect } from "next/navigation"
import { requireProfile } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { AdminClient } from "./admin-client"

export const metadata = { title: "Yönetici" }

export default async function AdminPage() {
  const me = await requireProfile()
  if (!isAdmin(me)) redirect("/feed")
  return <AdminClient />
}
