import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const MAX = 3 * 1024 * 1024
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/**
 * Profile photo chosen on the sign-up form, before the account exists.
 * Only small images are accepted; the database only keeps URLs from this folder.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > MAX) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }
  const admin = createAdminClient()
  const path = `signup/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`
  const { error } = await admin.storage.from("media").upload(path, file, { contentType: file.type })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: admin.storage.from("media").getPublicUrl(path).data.publicUrl })
}
