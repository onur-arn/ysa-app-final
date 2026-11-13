// "@Name" tags in feed posts: whatever the case or Turkish letters typed,
// "@baskanlar" = "@Başkanlar", "@onur arslan" = "@Onur Arslan".
// Same rules as public.mention_norm() / posts_resolve_mentions() in supabase/schema.sql.
const MAP: Record<string, string> = { "İ": "i", I: "i", "ı": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u", "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u" }

/** Lower-case without Turkish accents; one character in, one out, so positions line up. */
export function mentionNorm(s: string): string {
  let out = ""
  for (const c of s) {
    const m = MAP[c] ?? c.toLowerCase()
    out += [...m].length === 1 ? m : c
  }
  return out
}

export type MentionTarget<T> = { label: string; value: T }
export type MentionHit<T> = { start: number; end: number; target: MentionTarget<T> }

/** Every "@label" in the text (longest label wins, must end at a word boundary). */
export function findMentions<T>(text: string, targets: MentionTarget<T>[]): MentionHit<T>[] {
  const chars = [...text]
  const n = mentionNorm(text)
  const nChars = [...n]
  const sorted = targets.map((t) => ({ t, k: [...mentionNorm(t.label)] })).filter((x) => x.k.length).sort((a, b) => b.k.length - a.k.length)
  const hits: MentionHit<T>[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== "@" || (i > 0 && /[\p{L}\p{N}]/u.test(chars[i - 1]))) continue
    const found = sorted.find(({ k }) => k.every((c, j) => nChars[i + 1 + j] === c) && !/[\p{L}\p{N}]/u.test(nChars[i + 1 + k.length] ?? ""))
    if (found) {
      hits.push({ start: i, end: i + 1 + found.k.length, target: found.t })
      i += found.k.length
    }
  }
  return hits
}
