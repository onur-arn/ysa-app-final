import type { Metadata } from "next"
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Gizlilik Politikası · YouthStation" }

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Gizlilik Politikası / Privacy Policy" updated="Son güncelleme / Last updated: 6 Kasım 2026">
      <p>YouthStation, herkese açık bir sosyal ve organizasyon uygulamasıdır. Hesaplar yönetici onayıyla açılır. Sorularınız ve talepleriniz için: {mail}.</p>
      <h2>Topladığımız veriler</h2>
      <ul>
        <li>Hesap: ad, soyad, e-posta, telefon, doğum tarihi, memleket, istasyon, profil fotoğrafı ve isteğe bağlı LinkedIn adresi.</li>
        <li>Paylaştıklarınız: gönderiler, yorumlar, hikâyeler, mesajlar, sesli mesajlar, fotoğraflar ve dosyalar.</li>
        <li>Teknik veriler: oturum bilgileri, son görülme zamanı, bildirimler için cihaz belirteci.</li>
      </ul>
      <p>Bu veriler yalnızca hesabınızı yönetmek, kullanıcılar arası iletişimi sağlamak, etkinlikleri düzenlemek, bildirim göndermek ve kullanıcıları korumak için kullanılır. Reklam yapmıyoruz, verilerinizi satmıyoruz ve sizi uygulamalar arasında izlemiyoruz.</p>
      <h2>Kimler görebilir</h2>
      <p>Profiliniz ve paylaşımlarınız onaylı kullanıcılara görünür. Şikayet edilen içerikleri yöneticiler inceleyebilir; şikayet edilen bir mesajın bulunduğu konuşma, şikayet açık olduğu sürece yöneticiler tarafından okunabilir.</p>
      <h2>Hizmet sağlayıcılar</h2>
      <p>Uygulamayı çalıştırmak için şu sağlayıcıları kullanıyoruz: Supabase (veritabanı, dosyalar, oturum), Vercel (barındırma), Brevo (e-posta), Apple (iPhone bildirimleri). GIF ve müzik aramalarınız GIPHY ve Deezer’a iletilir. Bu sağlayıcılar verilerinizi yalnızca bu hizmetleri sunmak için işler ve bu politikadakine eşdeğer bir koruma sağlamakla yükümlüdür.</p>
      <h2>Saklama ve silme</h2>
      <p>Verileriniz hesabınız açık olduğu sürece saklanır. Hesabınızı istediğiniz an <strong>Ayarlar → Hesabımı sil</strong> ile silebilirsiniz: e-posta, telefon, doğum tarihi, memleket, LinkedIn adresi, fotoğraf ve cihaz belirteçleri silinir, giriş kalıcı olarak kapatılır. Daha önce paylaştığınız içerikler ve adınız, üstü çizili olarak diğer kullanıcıların konuşmalarında kalabilir; bunların silinmesini {mail} adresinden talep edebilirsiniz.</p>
      <h2>Haklarınız</h2>
      <p>KVKK ve GDPR kapsamında verilerinize erişme, düzeltme, silme, işlemeye itiraz etme ve onayınızı geri çekme hakkına sahipsiniz. Talepleriniz için {mail} adresine yazın.</p>

      <h2>English summary</h2>
      <p>YouthStation is a social and organization app open to everyone. Accounts are opened after approval by an administrator. We collect your account details (name, e-mail, phone, birthday, hometown, station, photo, optional LinkedIn), what you share (posts, comments, stories, messages, voice messages, photos, files) and technical data (session, last seen, push device token). We use them only to run your account, enable communication between users, organise events, send notifications and keep users safe. We show no ads, do not sell data and do not track you across apps.</p>
      <p>Your profile and content are visible to approved users. Admins can review reported content, and can read a conversation while a report on one of its messages is open. Service providers: Supabase, Vercel, Brevo and Apple; GIF and music searches go to GIPHY and Deezer. They process data only to provide these services and must offer protection equal to this policy.</p>
      <p>Data is kept while your account is open. You can delete your account at any time in <strong>Settings → Delete my account</strong>: your e-mail, phone, birthday, hometown, LinkedIn, photo and device tokens are erased and sign-in is closed for good. Content you already shared and your name may remain, struck through, in other users’ conversations; you can ask us to remove them at {mail}, which is also where to exercise your rights of access, correction, deletion, objection and withdrawal of consent.</p>
    </LegalPage>
  )
}
