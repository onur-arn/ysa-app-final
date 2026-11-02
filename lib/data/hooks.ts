"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useApp } from "@/components/providers/app-context"
import { qk } from "./keys"
import * as f from "./fetchers"

export const useMembers = () => {
  const { initialMembers } = useApp()
  return useQuery({ queryKey: qk.members, queryFn: f.fetchMembers, initialData: initialMembers, initialDataUpdatedAt: 0 })
}

/** id → member lookup that follows realtime profile changes */
export function useMemberMap() {
  const { data } = useMembers()
  return useMemo(() => {
    const map = new Map((data ?? []).map((m) => [m.id, m]))
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  }, [data])
}

export const useFeed = () => useQuery({ queryKey: qk.feed, queryFn: f.fetchFeed })
export const useStories = () => useQuery({ queryKey: qk.stories, queryFn: f.fetchStories })
export const useEvents = () => useQuery({ queryKey: qk.events, queryFn: f.fetchEvents })
export const useTasks = () => useQuery({ queryKey: qk.tasks, queryFn: f.fetchTasks })
export const useTaskComments = (id: string | null) =>
  useQuery({ queryKey: qk.taskComments(id ?? ""), queryFn: () => f.fetchTaskComments(id!), enabled: !!id })
export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: f.fetchConversations })
export const useConversation = (id: string) => useQuery({ queryKey: qk.conversation(id), queryFn: () => f.fetchConversation(id) })
export const useMessages = (id: string) => useQuery({ queryKey: qk.messages(id), queryFn: () => f.fetchMessages(id), staleTime: 30_000 })
export const useMessagePoll = (messageId: string) => useQuery({ queryKey: qk.polls(messageId), queryFn: () => f.fetchPoll(messageId) })
export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: f.fetchNotifications })

export function useUnreadMessages() {
  const { data } = useConversations()
  return (data ?? []).reduce((s, c) => s + (c.muted && !c.mentioned ? 0 : c.unread), 0)
}
