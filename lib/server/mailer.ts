import "server-only"

/** Who receives sign-up requests (Kabul et / Reddet e-mails). */
export const ADMIN_TO = process.env.ADMIN_EMAIL || "secretaire@youthstation.org"

export const mailConfigured = () => !!process.env.BREVO_API_KEY?.trim()

/** Transactional e-mail through Brevo (the provider already used by ysa-application). */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  if (!apiKey) throw new Error("BREVO_API_KEY manquant")
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Youth Station Derneği Uygulaması", email: process.env.BREVO_FROM_EMAIL?.trim() || "secretaire@youthstation.org" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text().catch(() => res.statusText)}`)
}

export const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** Simple branded HTML page returned when a link from an e-mail is opened. */
export function resultPage(type: "success" | "error", message: string) {
  const color = type === "success" ? "#16a34a" : "#dc2626"
  const icon = type === "success" ? "&#10003;" : "&#10007;"
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouthStation</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;max-width:420px;width:90%">
    <div style="font-size:52px;color:${color}">${icon}</div>
    <p style="font-size:15px;color:#374151;margin-top:16px;line-height:1.6">${message}</p>
  </div>
</body></html>`
}
