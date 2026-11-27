/** Every cached dataset of the app. The realtime hub keeps them in sync. */
export const qk = {
  me: ["me"] as const,
  members: ["members"] as const,
  feed: ["feed"] as const,
  stories: ["stories"] as const,
  events: ["events"] as const,
  tasks: ["tasks"] as const,
  taskComments: (id: string) => ["task-comments", id] as const,
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
  polls: (id: string) => ["poll", id] as const,
  notifications: ["notifications"] as const,
  reports: ["reports"] as const,
  stars: ["stars"] as const,
  notes: ["notes"] as const,
  media: (id: string, tab: string) => ["media", id, tab] as const,
}
