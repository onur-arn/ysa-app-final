import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  )
}

export function formatMoney(amount: number, currency = "EUR", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return ""
  const units = ["o", "Ko", "Mo", "Go"]
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** "YYYY-MM-DD" in local time (inputs of type=date) */
export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const p = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** "YYYY-MM-DDTHH:mm" in local time (inputs of type=datetime-local) */
export function toDateTimeInput(d: Date | string | null | undefined) {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const p = (n: number) => String(n).padStart(2, "0")
  return `${toDateInput(date)}T${p(date.getHours())}:${p(date.getMinutes())}`
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Download rows as a CSV file (UTF-8 BOM so Excel opens accents correctly). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = "﻿" + rows.map((r) => r.map(escape).join(";")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
