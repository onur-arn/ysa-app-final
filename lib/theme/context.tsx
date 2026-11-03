"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

/** Interface colour themes (Ayarlar → Renk teması). Values live in app/globals.css. */
export const PALETTES = [
  { id: "youthstation", name: "YouthStation", swatch: "#67A2B2", bg: "#ffffff" },
  { id: "okyanus", name: "Okyanus", swatch: "#3B6FD4", bg: "#f6f8fd" },
  { id: "lavanta", name: "Lavanta", swatch: "#8B5CD6", bg: "#f9f7fd" },
  { id: "gul", name: "Gül", swatch: "#E0607A", bg: "#fdf7f8" },
  { id: "orman", name: "Orman", swatch: "#2F9466", bg: "#f6fbf8" },
] as const

export type PaletteId = (typeof PALETTES)[number]["id"]
export const PALETTE_KEY = "ys-palette"

const ThemeContext = createContext<{ palette: PaletteId; setPalette: (p: PaletteId) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>("youthstation")

  useEffect(() => {
    const current = document.documentElement.dataset.palette as PaletteId | undefined
    if (current && PALETTES.some((p) => p.id === current)) setPaletteState(current)
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

export function usePalette() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("usePalette must be used within ThemeProvider")
  return ctx
}
