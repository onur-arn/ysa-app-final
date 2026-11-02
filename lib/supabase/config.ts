/** True when the Supabase env vars are present (see .env.example). */
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && url.startsWith("http") && !url.includes("xxxx")
}
