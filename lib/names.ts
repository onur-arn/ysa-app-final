// "NOM", "nom" → "Nom": one capital per word (also after "-", "'" and "."),
// spaces trimmed. Members mostly type without Turkish dotted letters
// ("YILMAZ", "Yildiz"), so I/İ inside a word become i. First letter: a typed
// i or İ gives İ (İsmail), a typed I or ı gives I (Işık).
// Same rules as public.format_name() in supabase/schema.sql.
const FIRST: Record<string, string> = { i: "İ", "İ": "İ", I: "I", "ı": "I" }
const REST: Record<string, string> = { I: "i", "İ": "i" }

export function formatName(raw: string): string {
  let out = ""
  let cap = true
  for (const c of raw.trim().replace(/\s+/g, " ")) {
    if (cap && /\p{L}/u.test(c)) {
      out += FIRST[c] ?? c.toUpperCase()
      cap = false
    } else {
      out += REST[c] ?? c.toLowerCase()
      if (" -'’.".includes(c)) cap = true
    }
  }
  return out
}
