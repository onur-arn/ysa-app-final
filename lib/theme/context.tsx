"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

/** Interface colour themes (Ayarlar → Renk teması). Values live in app/globals.css. */
export const PALETTES = [
  { id: "youthstation", name: "Turkuaz", swatch: "#5a9bad", bg: "#ffffff" },
  { id: "pembe", name: "Pembe", swatch: "#ec4899", bg: "#fdf0f5" },
  { id: "gece", name: "Gece", swatch: "#ffffff", bg: "#121212" },
  { id: "kirmizi", name: "Kırmızı", swatch: "#d62828", bg: "#fdf4f2" },
  { id: "gunbatimi", name: "Gün Batımı", swatch: "#f08a24", bg: "#fdf4ea" },
] as const

export type PaletteId = (typeof PALETTES)[number]["id"]
export const PALETTE_KEY = "ys-palette"

const ThemeContext = createContext<{ palette: PaletteId; setPalette: (p: PaletteId) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>("youthstation")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PALETTE_KEY) as PaletteId | null
      if (saved && PALETTES.some((p) => p.id === saved)) setPaletteState(saved)
      else if (saved) localStorage.removeItem(PALETTE_KEY) // palette from an older version
    } catch {}
  }, [])

  const setPalette = useCallback((p: PaletteId) => {
    setPaletteState(p)
    document.documentElement.dataset.palette = p
    try {
      localStorage.setItem(PALETTE_KEY, p)
    } catch {}
  }, [])

  return <ThemeContext.Provider value={{ palette, setPalette }}>{children}</ThemeContext.Provider>
}

/**
 * Mounted by the (app) layout: the chosen palette only colours the app itself.
 * Leaving the app (logout → login page) restores the light default.
 */
export function PaletteScope() {
  const { palette } = usePalette()
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    return () => {
      document.documentElement.dataset.palette = "youthstation"
    }
  }, [palette])
  return null
}

export function usePalette() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("usePalette must be used within ThemeProvider")
  return ctx
}
