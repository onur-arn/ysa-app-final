import { NextResponse, type NextRequest } from "next/server"
import { esc, resultPage } from "@/lib/server/mailer"
import { decideSignup } from "@/lib/server/signups"
import { verifyDecision } from "@/lib/server/signup-token"

const html = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })

/** Target of the "Kabul et" / "Reddet" buttons in the secretariat's e-mail. */
export async function GET(req: NextRequest) {
  const decision = verifyDecision(req.nextUrl.searchParams.get("token") ?? "")
  if (!decision) return html(resultPage("error", "Geçersiz veya bozuk bağlantı."), 400)

  const res = await decideSignup(decision.userId, decision.action)
  if (!res.ok) {
    if (res.reason === "already_decided") {
      const state = res.status === "active" ? "zaten onaylandı" : "zaten reddedildi"
      return html(resultPage("error", `<strong>${esc(res.name)}</strong> için talep ${state}.`))
    }
    return html(resultPage("error", "Bu talep bulunamadı (hesap silinmiş olabilir)."), 404)
  }
  if (decision.action === "reject") return html(resultPage("success", `<strong>${esc(res.name)}</strong> adlı kişinin talebi reddedildi.`))
  return html(resultPage("success", `<strong>${esc(res.name)}</strong> artık YouthStation üyesi 🎉<br>${res.mailed ? "Kendisine onay e-postası gönderildi." : "<small style=\"color:#b45309\">Onay e-postası gönderilemedi.</small>"}`))
}
