// Demo accounts + sample data for the Supabase project in .env.local.
// Re-runnable: passwords are reset, sample data is inserted only once.   npm run seed:demo
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local).")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const PASSWORD = "YsaDemo2026!"
const USERS = [
  { key: "admin", email: "admin@example.com", first_name: "Ayşe", last_name: "Yılmaz", station_id: "intl", position: "Başkan", app_role: "admin", status: "active", phone: "+33 6 11 22 33 44", hometown: "Ankara" },
  { key: "intl", email: "intl@example.com", first_name: "Deniz", last_name: "Kara", station_id: "intl", position: "Sekreter", app_role: "member", status: "active", phone: "+49 151 2345 6789", hometown: "İzmir" },
  { key: "paris", email: "paris@example.com", first_name: "Berk", last_name: "Aydın", station_id: "paris", position: null, app_role: "member", status: "active", phone: "06 12 34 56 78", hometown: "Adana" },
  { key: "lyon", email: "lyon@example.com", first_name: "Zeynep", last_name: "Demir", station_id: "lyon", position: "Proje Direktörü", app_role: "member", status: "active", phone: "+33 7 98 76 54 32", hometown: "Trabzon" },
  { key: "pending", email: "attente@example.com", first_name: "Elif", last_name: "Arslan", station_id: "nancy", position: null, app_role: "member", status: "pending", phone: null, hometown: "Konya" },
]
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const at = (days, hour = 19) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

async function upsertUser(u, i) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users.find((x) => x.email === u.email)
  const meta = { first_name: u.first_name, last_name: u.last_name, station_id: u.station_id }
  const user = existing
    ? must(await db.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true, user_metadata: meta }), u.email).user
    : must(await db.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: meta }), u.email).user
  must(await db.from("profiles").update({
    first_name: u.first_name, last_name: u.last_name, station_id: u.station_id, position: u.position, app_role: u.app_role, status: u.status,
    phone: u.phone, hometown: u.hometown, birthday: `200${i}-${String(new Date().getMonth() + 1).padStart(2, "0")}-1${i}`,
    approved_at: u.status === "active" ? new Date().toISOString() : null,
  }).eq("id", user.id), `profil ${u.email}`)
  return user.id
}

async function seed(id) {
  const { count } = await db.from("posts").select("id", { count: "exact", head: true })
  if (count) return console.log("• Données d'exemple déjà présentes, ignorées.")

  must(await db.from("posts").insert([
    { author_id: null, kind: "welcome", station_id: "paris", content: "Adanalı Berk Aydın Youth Station Uygulamasına giriş yaptı ! Acı biberi ve Adana kebabını bize de getirsin 🌶️ 👋" },
    { author_id: id.intl, station_id: "intl", pinned: true, content: "📌 Genel kurulumuz ay sonunda Paris'te! Tüm istasyonlar katılımını Takvim'den kontrol etsin." },
    { author_id: id.lyon, station_id: "lyon", kind: "igem", content: "Lyon'da bir iGEM eğitimi düzenlemek istiyorum, 12 kişilik bir grup hazır." },
  ], { defaultToNull: false }), "posts")
  const pollPost = must(await db.from("posts").insert({ author_id: id.paris, station_id: "paris", content: "Gala için hangi tarih?" }).select("id").single(), "poll post")
  const poll = must(await db.from("polls").insert({ post_id: pollPost.id, question: "Gala tarihi" }).select("id").single(), "poll")
  must(await db.from("poll_options").insert([{ poll_id: poll.id, label: "14 Aralık", position: 0 }, { poll_id: poll.id, label: "21 Aralık", position: 1 }]), "options")

  must(await db.from("events").insert([
    { title: "Kahvaltı & tanışma", starts_at: at(2, 10), location: "Paris 10e", station_id: "paris", created_by: id.paris },
    { title: "Lyon yönetim toplantısı", starts_at: at(5, 20), station_id: "lyon", is_private: true, created_by: id.lyon, description: "Sadece Lyon ekibi 🔒" },
    { title: "Erasmus+ gençlik değişimi", starts_at: at(14, 0), ends_at: at(20, 23), all_day: true, location: "Bükreş", station_id: null, created_by: id.intl },
    { title: "YouthStation Gala", starts_at: at(24, 19), ends_at: at(24, 23), location: "Strasbourg", station_id: null, created_by: id.admin },
  ], { defaultToNull: false }), "events")

  must(await db.from("tasks").insert([
    { title: "Gala afişini hazırla", priority: "urgent", station_id: "paris", assign_all: true, created_by: id.intl, due_date: at(4).slice(0, 10) },
    { title: "Erasmus+ başvuru formu", priority: "normal", status: "in_progress", station_id: "lyon", assignee_id: id.lyon, created_by: id.intl, due_date: at(10).slice(0, 10) },
    { title: "Yeni üyeleri karşıla", priority: "low", station_id: "paris", assignee_id: id.paris, created_by: id.paris },
  ], { defaultToNull: false }), "tasks")

  const group = must(await db.from("conversations").insert({ type: "group", name: "YouthStation Ekibi", created_by: id.admin }).select("id").single(), "group")
  must(await db.from("conversation_members").insert(["admin", "intl", "paris", "lyon"].map((k) => ({ conversation_id: group.id, user_id: id[k], is_admin: k === "admin" }))), "members")
  const say = async (conv, who, content, mentions = []) => must(await db.from("messages").insert({ conversation_id: conv, sender_id: id[who], content, mentions }).select("id").single(), "message").id
  await say(group.id, "admin", "Herkese merhaba 👋 Gala hazırlıkları başlıyor!")
  const pinned = await say(group.id, "intl", "📋 Gala görev dağılımı: afiş Paris, sponsorlar Lyon, ulaşım Uluslararası Büro.")
  await say(group.id, "paris", "Afişi bu hafta bitiriyoruz 💪")
  await say(group.id, "lyon", "@Berk Aydın afiş için logo dosyasını gönderebilir misin?", [id.paris])
  must(await db.from("conversations").update({ pinned_message_id: pinned, pinned_by: id.intl }).eq("id", group.id), "pin")

  const dm = must(await db.from("conversations").insert({ type: "dm", created_by: id.paris }).select("id").single(), "dm")
  must(await db.from("conversation_members").insert([{ conversation_id: dm.id, user_id: id.paris }, { conversation_id: dm.id, user_id: id.lyon }]), "dm members")
  await say(dm.id, "lyon", "Selam Berk! Hafta sonu Paris'e geliyorum ☕")
  await say(dm.id, "paris", "Harika, kahvaltıya bekliyoruz!")
  console.log("• Données d'exemple ajoutées.")
}

try {
  const id = {}
  for (const [i, u] of USERS.entries()) {
    id[u.key] = await upsertUser(u, i)
    console.log(`• ${u.email.padEnd(22)} ${u.station_id.padEnd(6)} ${u.app_role}/${u.status}`)
  }
  await seed(id)
  console.log(`\nMot de passe commun : ${PASSWORD}`)
} catch (e) {
  console.error("Échec :", e.message)
  process.exit(1)
}
