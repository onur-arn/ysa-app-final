import { createClient } from "@/lib/supabase/client"
import { FEED_RETENTION_DAYS } from "@/lib/constants"
import type { AppEvent, ConversationInfo, ConversationRow, Member, Message, Note, Notification, Poll, Post, Profile, Report, StarredMessage, Story, Task } from "@/lib/types"

const sb = () => createClient()

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export const MEMBER_COLUMNS =
  "id, first_name, last_name, full_name, email, phone, birthday, linkedin, hometown, station_id, position, app_role, status, photo_url, igem_trained, igem_date, points, last_seen_at, created_at"

export const fetchMe = async (id: string) => must(await sb().from("profiles").select("*").eq("id", id).single()) as Profile

export const fetchMembers = async () =>
  must(await sb().from("profiles").select(MEMBER_COLUMNS).in("status", ["active", "deleted"]).order("first_name")) as Member[]

export const POST_SELECT = "*, post_likes(user_id), post_comments(id, author_id, content, created_at), polls(*, poll_options(*), poll_votes(option_id, user_id))"

export async function fetchFeed() {
  const since = new Date(Date.now() - FEED_RETENTION_DAYS * 86400_000).toISOString()
  // Pinned posts stay visible past the 30-day window.
  const res = await sb()
    .from("posts")
    .select(POST_SELECT)
    .or(`created_at.gte.${since},pinned.eq.true`)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80)
  void sb().rpc("purge_old_posts").then(() => {}) // delete posts past the 30-day window
  return must(res) as unknown as Post[]
}

export const fetchStories = async () =>
  must(await sb().from("stories").select("*").gt("expires_at", new Date().toISOString()).order("created_at")) as Story[]

export async function fetchEvents() {
  const from = new Date()
  from.setMonth(from.getMonth() - 6)
  const [open, locked] = await Promise.all([
    sb().from("events").select("*").gte("starts_at", from.toISOString()).order("starts_at"),
    sb().rpc("locked_events"),
  ])
  // Private events of other stations come back as bare 🔒 slots, without any content.
  const slots = ((locked.data ?? []) as Pick<AppEvent, "id" | "starts_at" | "ends_at" | "all_day" | "station_id">[]).map(
    (e): AppEvent => ({ ...e, title: "", description: null, location: null, link: null, is_private: true, created_by: null, created_at: e.starts_at, locked: true }),
  )
  return [...(must(open) as AppEvent[]), ...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

export const fetchTasks = async () =>
  must(await sb().from("tasks").select("*, task_comments(count)").order("created_at", { ascending: false })) as unknown as Task[]

export const fetchTaskComments = async (taskId: string) =>
  must(await sb().from("task_comments").select("*").eq("task_id", taskId).order("created_at")) as { id: string; author_id: string; content: string; created_at: string }[]

export const fetchConversations = async () => (must(await sb().rpc("my_conversations")) as ConversationRow[]).map((c) => ({ ...c, unread: Number(c.unread) }))

export const fetchConversation = async (id: string) =>
  must(
    await sb()
      .from("conversations")
      .select("id, type, name, avatar_url, created_by, pinned_message_id, pinned_by, conversation_members(user_id, is_admin, muted, last_read_at)")
      .eq("id", id)
      .single(),
  ) as ConversationInfo

export const PAGE = 60

export async function fetchMessages(convId: string, before?: string) {
  let q = sb().from("messages").select("*, message_likes(user_id, emoji)").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(PAGE)
  if (before) q = q.lt("created_at", before)
  return (must(await q) as Message[]).reverse()
}

export const fetchMessage = async (id: string) => must(await sb().from("messages").select("*, message_likes(user_id, emoji)").eq("id", id).maybeSingle()) as Message | null

export const fetchPoll = async (messageId: string) =>
  must(await sb().from("polls").select("*, poll_options(*), poll_votes(option_id, user_id)").eq("message_id", messageId).maybeSingle()) as Poll | null

/** The bell. Chat messages have their own badge on the Mesajlar tab, and still arrive as push. */
export const fetchNotifications = async () =>
  must(await sb().from("notifications").select("*").neq("type", "message").order("created_at", { ascending: false }).limit(5)) as Notification[]

export const fetchReports = async () =>
  must(await sb().from("reports").select("*").order("created_at", { ascending: false }).limit(200)) as Report[]

/** Messages from `since` onwards (to jump to an older message: search, ⭐, media). */
export async function fetchMessagesFrom(convId: string, since: string) {
  const q = sb().from("messages").select("*, message_likes(user_id, emoji)").eq("conversation_id", convId).gte("created_at", since).order("created_at").limit(1000)
  return must(await q) as Message[]
}

/** ⭐ The member's important messages, newest first. */
export const fetchStars = async () =>
  must(await sb().from("message_stars").select("message_id, created_at, messages(*)").order("created_at", { ascending: false }).limit(500)) as unknown as StarredMessage[]

export type MediaTab = "media" | "docs" | "links"
/** Photos, documents or links shared in a conversation (Medya, belgeler, bağlantılar). */
export async function fetchConversationMedia(convId: string, tab: MediaTab) {
  let q = sb().from("messages").select("id, conversation_id, sender_id, kind, content, attachment_url, attachment_name, attachment_size, created_at")
    .eq("conversation_id", convId).is("deleted_at", null).order("created_at", { ascending: false }).limit(300)
  if (tab === "media") q = q.in("kind", ["image", "gif"])
  else if (tab === "docs") q = q.eq("kind", "file")
  else q = q.eq("kind", "text").or("content.ilike.%http%,content.ilike.%www.%")
  return must(await q) as Message[]
}

/** Text search inside one conversation. */
export async function searchMessages(convId: string, text: string) {
  const term = text.replace(/[%_,()]/g, " ").trim()
  if (!term) return []
  return must(await sb().from("messages").select("*").eq("conversation_id", convId).is("deleted_at", null).ilike("content", `%${term}%`).order("created_at", { ascending: false }).limit(100)) as Message[]
}

export const fetchNotes = async () =>
  must(await sb().from("notes").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false })) as Note[]
