import { NextResponse, type NextRequest } from "next/server"
import { confirmPage, esc, resultPage } from "@/lib/server/mailer"
import { decideSignup } from "@/lib/server/signups"
import { verifyDecision } from "@/lib/server/signup-token"
import { createAdminClient } from "@/lib/supabase/server"

const html = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
const invalid = () => html(resultPage("error", "Geçersiz, bozuk veya süresi dolmuş bağlantı. Talebi Yönetici panelinden yönetebilirsiniz."), 400)
const notFound = () => html(resultPage("error", "Bu talep bulunamadı (hesap silinmiş olabilir)."), 404)
const alreadyDecided = (name: string, status: string) =>
  html(resultPage("error", `<strong>${esc(name)}</strong> için talep ${status === "active" ? "zaten onaylandı" : "zaten reddedildi"}.`))

/** Target of the "Kabul et" / "Reddet" buttons in the secretariat's e-mail: only asks for confirmation. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const decision = verifyDecision(token)
  if (!decision) return invalid()

  const { data: p } = await createAdminClient().from("profiles").select("full_name, status").eq("id", decision.userId).maybeSingle()
  if (!p) return notFound()
  if (p.status !== "pending") return alreadyDecided(p.full_name, p.status)
  return html(confirmPage(decision.action, p.full_name, token))
}

/** The confirmation form: this is what actually decides. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const decision = verifyDecision(String(form?.get("token") ?? ""))
  if (!decision) return invalid()

  const res = await decideSignup(decision.userId, decision.action)
  if (!res.ok) return res.reason === "already_decided" ? alreadyDecided(res.name, res.status) : notFound()
  if (decision.action === "reject") return html(resultPage("success", `<strong>${esc(res.name)}</strong> adlı kişinin talebi reddedildi.`))
  return html(resultPage("success", `<strong>${esc(res.name)}</strong> artık YouthStation üyesi 🎉<br>${res.mailed ? "Kendisine onay e-postası gönderildi." : "<small style=\"color:#b45309\">Onay e-postası gönderilemedi.</small>"}`))
}
