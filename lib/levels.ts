/** Grades earned through activity in the app (see POINT_RULES / supabase/schema.sql). */
export const LEVELS = [
  { min: 0, key: "rookie", emoji: "🌱", color: "150 55% 42%" },
  { min: 150, key: "talker", emoji: "🤝", color: "199 89% 45%" },
  { min: 500, key: "active", emoji: "⭐", color: "45 90% 45%" },
  { min: 1500, key: "master", emoji: "🔥", color: "24 90% 52%" },
  { min: 3500, key: "ambassador", emoji: "🏅", color: "280 55% 55%" },
  { min: 7500, key: "legend", emoji: "👑", color: "350 75% 55%" },
] as const

/** Mirrors the point triggers in the database */
export const POINT_RULES = [
  { key: "task", points: 10, emoji: "✅" },
  { key: "event", points: 5, emoji: "📅" },
  { key: "post", points: 3, emoji: "📝" },
  { key: "story", points: 2, emoji: "📸" },
  { key: "comment", points: 2, emoji: "💬" },
  { key: "like", points: 1, emoji: "❤️" },
  { key: "vote", points: 1, emoji: "📊" },
  { key: "message", points: 1, emoji: "✉️" },
] as const

export function levelOf(points: number) {
  let i = 0
  while (i < LEVELS.length - 1 && points >= LEVELS[i + 1].min) i++
  const current = LEVELS[i]
  const next = LEVELS[i + 1]
  const progress = next ? (points - current.min) / (next.min - current.min) : 1
  return { index: i, current, next, progress, toNext: next ? next.min - points : 0 }
}
