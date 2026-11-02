/** Minimal iCalendar export so members can add an event to their own calendar. */
export function downloadIcs(ev: { id: string; title: string; description?: string | null; location?: string | null; starts_at: string; ends_at?: string | null; all_day?: boolean }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const start = new Date(ev.starts_at)
  const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 2 * 3600 * 1000)
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YouthStation//ysa-app-final//TR", "BEGIN:VEVENT",
    `UID:${ev.id}@youthstation`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(ev.title)}`,
    ev.location ? `LOCATION:${esc(ev.location)}` : "", ev.description ? `DESCRIPTION:${esc(ev.description)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n")
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${ev.title.replace(/[^\w-]+/g, "_")}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
