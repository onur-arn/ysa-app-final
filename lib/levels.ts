/** Grades earned with messages sent (1 message = 1 point). */
export const LEVELS = [
  { min: 0, key: "rookie", emoji: "🌱", color: "150 55% 42%" },
  { min: 25, key: "talker", emoji: "💬", color: "199 89% 45%" },
  { min: 100, key: "active", emoji: "⭐", color: "45 90% 45%" },
  { min: 250, key: "master", emoji: "🔥", color: "24 90% 52%" },
  { min: 500, key: "ambassador", emoji: "🏅", color: "280 55% 55%" },
  { min: 1000, key: "legend", emoji: "👑", color: "350 75% 55%" },
] as const

export function levelOf(points: number) {
  let i = 0
  while (i < LEVELS.length - 1 && points >= LEVELS[i + 1].min) i++
  const current = LEVELS[i]
  const next = LEVELS[i + 1]
  const progress = next ? (points - current.min) / (next.min - current.min) : 1
  return { index: i, current, next, progress, toNext: next ? next.min - points : 0 }
}
