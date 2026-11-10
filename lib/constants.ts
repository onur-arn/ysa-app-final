import type { TaskPriority, TaskStatus } from "./types"

export const TONE = {
  neutral: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/12 text-primary",
  green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/12 text-red-600 dark:text-red-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  blue: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
} as const
export type Tone = keyof typeof TONE

export const TASK_STATUSES: { id: TaskStatus; tone: Tone }[] = [
  { id: "todo", tone: "neutral" },
  { id: "in_progress", tone: "blue" },
  { id: "done", tone: "green" },
]

export const TASK_PRIORITIES: { id: TaskPriority; tone: Tone }[] = [
  { id: "urgent", tone: "red" },
  { id: "normal", tone: "primary" },
  { id: "low", tone: "neutral" },
]

export const FEED_RETENTION_DAYS = 30

export const BOARD_POSITIONS = [
  "Başkan", "Sekreter", "Sayman", "Proje Direktörü", "Dış İlişkiler Direktörü", "İç İlişkiler Direktörü",
  "Kurumsal İletişim Direktörü", "Eğitim Koordinatörü", "Avrupa Birliği Projeler Sorumlusu",
] as const

export const EXECUTIVE_POSITIONS = [
  "İnovasyon ve Girişimcilik Proje Direktörü", "Kültür ve Sanat Proje Direktörü", "Gençlik ve Çevre Proje Direktörü",
  "Dezavantajlı Gruplar ve Sosyal Dahil Etme Proje Direktörü", "Demokratik Katılım Proje Direktörü", "Gençlik Sağlığı Proje Direktörü",
] as const

export const POSITIONS = [...BOARD_POSITIONS, ...EXECUTIVE_POSITIONS] as const

/** The Yürütme Kurulu only exists in Uluslararası Büro: other stations have the Yönetim Kurulu only. */
export const isExecutivePosition = (p: string | null | undefined) => (EXECUTIVE_POSITIONS as readonly string[]).includes(p ?? "")
export const positionsFor = (stationId: string | null | undefined): readonly string[] => (stationId === "intl" ? POSITIONS : BOARD_POSITIONS)

export const HOMETOWNS = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum",
  "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
]
