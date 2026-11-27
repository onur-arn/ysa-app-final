export type Station = { id: string; name: string; short: string; city: string; color: string; position: number; lat: number | null; lng: number | null }

export type NotifPrefs = { messages: boolean; tasks: boolean; events: boolean; members: boolean; posts?: boolean }

export type Profile = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string | null
  birthday: string | null
  linkedin: string | null
  hometown: string | null
  station_id: string | null
  position: string | null
  app_role: "member" | "admin"
  status: "pending" | "active" | "suspended" | "rejected"
  photo_url: string | null
  igem_trained: boolean
  igem_date: string | null
  points: number
  notif_prefs: NotifPrefs
  last_seen_at: string | null
  approved_at: string | null
  created_at: string
}

/** Directory row (every active member, kept in the realtime cache) */
export type Member = Omit<Profile, "notif_prefs" | "approved_at">

export type Poll = {
  id: string
  question: string
  multiple: boolean
  poll_options: { id: string; label: string; position: number }[]
  poll_votes: { option_id: string; user_id: string }[]
}

export type Post = {
  id: string
  author_id: string | null
  station_id: string | null
  kind: "post" | "welcome" | "igem"
  content: string
  image_url: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  pinned: boolean
  mentions: string[]
  mention_stations: string[]
  mention_groups: string[]
  created_at: string
  /** set when the author changed the text ("düzenlendi") */
  edited_at?: string | null
  post_likes: { user_id: string }[]
  post_comments: { id: string; author_id: string; content: string; created_at: string }[]
  polls: Poll | null
}

export type Story = {
  id: string
  author_id: string
  image_url: string
  fit_mode: "cover" | "contain"
  music_preview_url: string | null
  music_label: string | null
  created_at: string
}

export type AppEvent = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  location: string | null
  link: string | null
  station_id: string | null
  is_private: boolean
  created_by: string | null
  created_at: string
  /** private event of another station: only the time slot is known (🔒) */
  locked?: boolean
}

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "normal" | "urgent"

export type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  station_id: string
  assignee_id: string | null   // first of assignee_ids
  assignee_ids: string[]
  assign_all: boolean
  created_by: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  task_comments: { count: number }[]
}

export type ConversationRow = {
  id: string
  type: "group" | "dm"
  name: string | null
  avatar_url: string | null
  last_message_at: string
  unread: number
  mentioned: boolean
  muted: boolean
  last_content: string | null
  last_kind: string | null
  last_sender: string | null
  other_id: string | null
  other_last_read: string | null
}

export type ConversationInfo = {
  id: string
  type: "group" | "dm"
  name: string | null
  avatar_url: string | null
  created_by: string | null
  pinned_message_id: string | null
  pinned_by: string | null
  conversation_members: { user_id: string; is_admin: boolean; muted: boolean; last_read_at: string }[]
}

export type MessageKind = "text" | "image" | "file" | "audio" | "gif" | "poll" | "system"

export type Message = {
  id: string
  conversation_id: string
  sender_id: string | null
  kind: MessageKind
  content: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_size: number | null
  mentions: string[]
  reply_to: string | null
  deleted_at: string | null
  created_at: string
  /** copy forwarded from another conversation (column added 24/11/2026) */
  forwarded?: boolean
  /** set when the sender changed the text ("düzenlendi") */
  edited_at?: string | null
  /** reactions: one per member (emoji added 27/11/2026, ❤️ before) */
  message_likes?: { user_id: string; emoji?: string }[]
  /** client-only: optimistic message not yet confirmed */
  pending?: boolean
}

export type Notification = {
  id: string
  type: "message" | "mention" | "task" | "event" | "member" | "comment" | string
  title: string
  body: string | null
  link: string | null
  actor_id: string | null
  count: number
  read_at: string | null
  created_at: string
}

export type Report = {
  id: string
  reporter_id: string | null
  kind: "message" | "post" | "comment" | "user" | "event" | "task"
  target_id: string
  conversation_id: string | null
  reason: string | null
  status: "open" | "resolved" | "dismissed"
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

/** Shared note of a station (Görevler → Notlar), visible to that station and the stations it is shared with. */
export type Note = {
  id: string
  station_id: string
  shared_stations: string[]
  title: string
  content: string
  color: string | null
  pinned: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** A message the member marked as important (⭐). */
export type StarredMessage = { message_id: string; created_at: string; messages: Message | null }
