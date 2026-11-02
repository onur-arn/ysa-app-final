"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light" | "dark"
const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(t)
    try {
      localStorage.setItem("ys-theme", t)
    } catch {}
  }, [])

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme])

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
