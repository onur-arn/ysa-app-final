export type Lang = "tr" | "fr" | "en"

export const LANGS: { code: Lang; label: string; flag: string; locale: string }[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷", locale: "tr-TR" },
  { code: "fr", label: "Français", flag: "🇫🇷", locale: "fr-FR" },
  { code: "en", label: "English", flag: "🇬🇧", locale: "en-GB" },
]

export const DEFAULT_LANG: Lang = "tr"
export const LANG_COOKIE = "ysa-lang"

export function isLang(v: unknown): v is Lang {
  return v === "tr" || v === "fr" || v === "en"
}

export function localeOf(lang: Lang) {
  return LANGS.find((l) => l.code === lang)?.locale ?? "tr-TR"
}
