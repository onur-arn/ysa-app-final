import type { Metadata } from "next"
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Gizlilik Politikası · YouthStation" }

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>

// Same text as https://ysa-privacy-policy.vercel.app (the URL given to the App Store): keep both in sync.
export default function PrivacyPage() {
  return (
    <LegalPage title="Gizlilik Politikası / Privacy Policy" updated="Son güncelleme / Last updated: 9 Kasım 2026">
      <p>YouthStation, bir sosyal ve organizasyon uygulamasıdır. Hesaplar yönetici onayıyla açılır. Sorularınız ve talepleriniz için: {mail}.</p>
      <h2>Topladığımız veriler</h2>
      <ul>
        <li>Hesap: ad, soyad, e-posta, telefon, doğum tarihi, memleket, istasyon, profil fotoğrafı ve isteğe bağlı LinkedIn adresi.</li>
        <li>Paylaştıklarınız: gönderiler, yorumlar, hikâyeler, mesajlar, sesli mesajlar, fotoğraflar ve dosyalar.</li>
        <li>Teknik veriler: oturum bilgileri, son görülme zamanı, bildirimler için cihaz belirteci.</li>
      </ul>
      <p>Bu veriler yalnızca hesabınızı yönetmek, kullanıcılar arası iletişimi sağlamak, etkinlikleri düzenlemek, bildirim göndermek ve kullanıcıları korumak için kullanılır. Reklam yapmıyoruz, verilerinizi satmıyoruz ve sizi uygulamalar arasında izlemiyoruz.</p>
      <h2>Kimler görebilir</h2>
      <p>Profiliniz ve paylaşımlarınız onaylı kullanıcılara görünür. Şikayet edilen içerikleri yöneticiler inceleyebilir; şikayet edilen bir mesajın bulunduğu konuşma, şikayet açık olduğu sürece yöneticiler tarafından okunabilir.</p>
      <h2>Saklama ve silme</h2>
      <p>Verileriniz hesabınız açık olduğu sürece saklanır. Hesabınızı istediğiniz an <strong>Ayarlar → Hesabımı sil</strong> ile silebilirsiniz: e-posta, telefon, doğum tarihi, memleket, LinkedIn adresi, fotoğraf ve cihaz belirteçleri silinir, giriş kalıcı olarak kapatılır.</p>
      <h2>Haklarınız</h2>
      <p>KVKK ve GDPR kapsamında verilerinize erişme, düzeltme, silme, işlemeye itiraz etme ve onayınızı geri çekme hakkına sahipsiniz. Talepleriniz için {mail} adresine yazın.</p>

      <h2>English</h2>
      <p>YouthStation is a social and organization app. Accounts are opened after approval by an administrator. For any questions or requests, contact us at {mail}.</p>
      <p><strong>Data we collect.</strong> Account: first name, last name, e-mail address, phone number, date of birth, hometown, station, profile photo and, optionally, your LinkedIn address. What you share: posts, comments, stories, messages, voice messages, photos and files. Technical data: session information, last seen time and a device token used for notifications. This data is used only to manage your account, enable communication between users, organize events, send notifications and keep users safe. We do not show ads, we do not sell your data and we do not track you across apps.</p>
      <p><strong>Who can see it.</strong> Your profile and your posts are visible to approved users. Administrators may review reported content; a conversation containing a reported message can be read by administrators for as long as the report remains open.</p>
      <p><strong>Retention and deletion.</strong> Your data is kept for as long as your account is open. You can delete your account at any time in <strong>Settings → Delete my account</strong>: your e-mail address, phone number, date of birth, hometown, LinkedIn address, photo and device tokens are erased, and sign-in is permanently disabled.</p>
      <p><strong>Your rights.</strong> Under the KVKK and the GDPR, you have the right to access, correct and delete your data, to object to its processing and to withdraw your consent. To exercise these rights, write to {mail}.</p>
    </LegalPage>
  )
}
