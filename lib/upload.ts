"use client"

import { createClient } from "@/lib/supabase/client"

const ext = (name: string) => {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot).toLowerCase() : ""
}
const uniqueName = (name: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext(name)}`

export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf"

/** Public "media" bucket (photos, stories, voice notes) — returns the public URL. */
export async function uploadMedia(file: Blob, userId: string, folder: string, name = "file") {
  const supabase = createClient()
  const path = `${userId}/${folder}/${uniqueName((file as File).name ?? name)}`
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl
}

/**
 * Private "files" bucket for PDFs and documents. `scope` is a conversation id
 * (only its members can read it) or "feed" (every active member).
 */
export async function uploadFile(file: File, scope: string) {
  const supabase = createClient()
  const path = `${scope}/${uniqueName(file.name)}`
  const { error } = await supabase.storage.from("files").upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return path
}

/** Short-lived signed link to read a private file (PDF viewer). */
export async function signedFileUrl(path: string) {
  const { data, error } = await createClient().storage.from("files").createSignedUrl(path, 300)
  if (error || !data) throw error ?? new Error("signed url")
  return data.signedUrl
}

/** Short-lived signed link that downloads the file with its original name. */
export async function downloadFile(path: string, fileName: string, mode: "download" | "open" = "download") {
  const { data, error } = await createClient().storage.from("files").createSignedUrl(path, 300, mode === "download" ? { download: fileName } : undefined)
  if (error || !data) throw error ?? new Error("signed url")
  if (mode === "open") window.open(data.signedUrl, "_blank", "noopener")
  else {
    const a = document.createElement("a")
    a.href = data.signedUrl
    a.click()
  }
}

export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
}
