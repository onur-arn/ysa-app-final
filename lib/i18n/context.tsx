"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { DICT } from "./dict"
import { LANG_COOKIE, localeOf, type Lang } from "./config"

type Vars = Record<string, string | number>

type I18nContextType = {
  lang: Lang
  locale: string
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Vars) => string
  /** Format a date with the current locale */
  fmtDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string
  fmtRelative: (d: string | Date) => string
}

const I18nContext = createContext<I18nContextType | null>(null)
const INDEX: Record<Lang, number> = { tr: 0, fr: 1, en: 2 }

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const locale = localeOf(lang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
  }, [])

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const entry = DICT[key]
      let s = entry ? entry[INDEX[lang]] : key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
      return s
    },
    [lang],
  )

  const value = useMemo<I18nContextType>(() => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    return {
      lang,
      locale,
      setLang,
      t,
      fmtDate: (d, opts = { day: "numeric", month: "short", year: "numeric" }) =>
        new Intl.DateTimeFormat(locale, opts).format(typeof d === "string" ? new Date(d) : d),
      fmtRelative: (d) => {
        const diff = (new Date(d).getTime() - Date.now()) / 1000
        const abs = Math.abs(diff)
        if (abs < 60) return rtf.format(Math.round(diff), "second")
        if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
        if (abs < 604800) return rtf.format(Math.round(diff / 86400), "day")
        return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(d))
      },
    }
  }, [lang, locale, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
