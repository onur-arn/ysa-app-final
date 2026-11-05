import type { Metadata } from "next"
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Kullanım Koşulları · YouthStation" }

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>

export default function TermsPage() {
  return (
    <LegalPage title="Kullanım Koşulları / Terms of Use" updated="Son güncelleme / Last updated: 5 Kasım 2026">
      <p>YouthStation’ı kullanarak bu koşulları kabul etmiş olursunuz. Hesaplar yönetici onayıyla açılır.</p>
      <h2>Uygunsuz içeriğe sıfır tolerans</h2>
      <p>Taciz, zorbalık, nefret söylemi, tehdit, cinsel içerik, şiddet, yasa dışı içerik, başkasının izni olmadan paylaşılan özel görüntü ve spam kesinlikle yasaktır. Paylaştığınız içerikten siz sorumlusunuz.</p>
      <h2>Şikayet ve engelleme</h2>
      <p>Her gönderi, mesaj, hikâye ve profil için <strong>Şikayet et</strong>, her profil için <strong>Engelle</strong> seçeneği vardır. Yöneticiler şikayetleri 24 saat içinde inceler, uygunsuz içeriği kaldırır ve kuralları ihlal eden üyelerin hesabını kapatır. Bize her zaman {mail} adresinden de ulaşabilirsiniz.</p>
      <h2>Hesabınız</h2>
      <p>Hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı istediğiniz an Ayarlar bölümünden silebilirsiniz. Verilerinizin işlenmesi <a href="/gizlilik" className="underline underline-offset-2">Gizlilik Politikası</a>’nda açıklanmıştır.</p>

      <h2>English summary</h2>
      <p>Accounts are opened after approval by an administrator. There is <strong>no tolerance for objectionable content or abusive users</strong>: harassment, bullying, hate speech, threats, sexual or violent content, illegal content, intimate images shared without consent and spam are forbidden, and you are responsible for what you post.</p>
      <p>Every post, message, story and profile can be reported, and any member can be blocked. Admins review reports within 24 hours, remove objectionable content and close the accounts of those who break these rules. You can also reach us at {mail}. You can delete your account at any time in Settings.</p>
    </LegalPage>
  )
}
