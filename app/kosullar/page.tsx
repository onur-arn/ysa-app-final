import type { Metadata } from "next"
import { CONTACT_EMAIL, LegalPage, PRIVACY_URL } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Kullanım Koşulları · YouthStation" }

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>

// Same text as https://ysa-privacy-policy.vercel.app/kosullar: keep both in sync.
export default function TermsPage() {
  return (
    <LegalPage title="Kullanım Koşulları / Terms of Use" updated="Son güncelleme / Last updated: 9 Kasım 2026">
      <p>YouthStation’ı kullanarak bu koşulları kabul etmiş olursunuz. Hesaplar yönetici onayıyla açılır.</p>
      <h2>Uygunsuz içeriğe sıfır tolerans</h2>
      <p>Taciz, zorbalık, nefret söylemi, tehdit, cinsel içerik, şiddet, yasa dışı içerik, başkasının izni olmadan paylaşılan özel görüntü ve spam kesinlikle yasaktır. Paylaştığınız içerikten siz sorumlusunuz.</p>
      <h2>Şikayet</h2>
      <p>Her gönderi, mesaj, hikâye ve profil için <strong>Şikayet et</strong> seçeneği vardır. Yöneticiler şikayetleri 24 saat içinde inceler, uygunsuz içeriği kaldırır ve kuralları ihlal eden üyelerin hesabını kapatır. Bize her zaman {mail} adresinden de ulaşabilirsiniz.</p>
      <h2>Hesabınız</h2>
      <p>Hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı istediğiniz an Ayarlar bölümünden silebilirsiniz. Verilerinizin işlenmesi <a href={PRIVACY_URL} className="underline underline-offset-2">Gizlilik Politikası</a>’nda açıklanmıştır.</p>

      <h2>English</h2>
      <p>By using YouthStation, you agree to these terms. Accounts are opened after approval by an administrator.</p>
      <p><strong>Zero tolerance for objectionable content.</strong> Harassment, bullying, hate speech, threats, sexual content, violence, illegal content, intimate images shared without the other person’s consent and spam are strictly prohibited. You are responsible for the content you share.</p>
      <p><strong>Reporting.</strong> Every post, message, story and profile has a <strong>Report</strong> option. Administrators review reports within 24 hours, remove objectionable content and close the accounts of members who break these rules. You can also reach us at any time at {mail}.</p>
      <p><strong>Your account.</strong> You are responsible for the security of your account. You can delete your account at any time from the Settings section. How your data is processed is explained in our <a href={PRIVACY_URL} className="underline underline-offset-2">Privacy Policy</a>.</p>
    </LegalPage>
  )
}
