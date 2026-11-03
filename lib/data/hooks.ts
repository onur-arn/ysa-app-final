"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { useMemo } from "react"
import { useApp } from "@/components/providers/app-context"
import { useHydrated } from "@/lib/use-hydrated"
import { qk } from "./keys"
import * as f from "./fetchers"

/** During hydration, render what the server rendered (no cached data), then switch. */
function hydrationSafe<T>(q: UseQueryResult<T>, hydrated: boolean, fallback?: T): UseQueryResult<T> {
  return hydrated ? q : ({ ...q, data: fallback, isPending: fallback === undefined } as UseQueryResult<T>)
}

export const useMembers = () => {
  const { initialMembers } = useApp()
  const hydrated = useHydrated()
  const q = useQuery({ queryKey: qk.members, queryFn: f.fetchMembers, initialData: initialMembers, initialDataUpdatedAt: 0 })
  return hydrationSafe(q, hydrated, initialMembers)
}

/** id → member lookup that follows realtime profile changes */
export function useMemberMap() {
  const { data } = useMembers()
  return useMemo(() => {
    const map = new Map((data ?? []).map((m) => [m.id, m]))
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  }, [data])
}

export const useFeed = () => hydrationSafe(useQuery({ queryKey: qk.feed, queryFn: f.fetchFeed }), useHydrated())
export const useStories = () => hydrationSafe(useQuery({ queryKey: qk.stories, queryFn: f.fetchStories }), useHydrated())
export const useEvents = () => hydrationSafe(useQuery({ queryKey: qk.events, queryFn: f.fetchEvents }), useHydrated())
export const useTasks = () => hydrationSafe(useQuery({ queryKey: qk.tasks, queryFn: f.fetchTasks }), useHydrated())
export const useTaskComments = (id: string | null) =>
  useQuery({ queryKey: qk.taskComments(id ?? ""), queryFn: () => f.fetchTaskComments(id!), enabled: !!id })
export const useConversations = () => hydrationSafe(useQuery({ queryKey: qk.conversations, queryFn: f.fetchConversations }), useHydrated())
export const useConversation = (id: string) => hydrationSafe(useQuery({ queryKey: qk.conversation(id), queryFn: () => f.fetchConversation(id) }), useHydrated())
export const useMessages = (id: string) => hydrationSafe(useQuery({ queryKey: qk.messages(id), queryFn: () => f.fetchMessages(id), staleTime: 30_000 }), useHydrated())
export const useMessagePoll = (messageId: string) => hydrationSafe(useQuery({ queryKey: qk.polls(messageId), queryFn: () => f.fetchPoll(messageId) }), useHydrated())
export const useNotifications = () => hydrationSafe(useQuery({ queryKey: qk.notifications, queryFn: f.fetchNotifications }), useHydrated())
export const useReports = (enabled: boolean) => hydrationSafe(useQuery({ queryKey: qk.reports, queryFn: f.fetchReports, enabled }), useHydrated())

export function useUnreadMessages() {
  const { data } = useConversations()
  return (data ?? []).reduce((s, c) => s + (c.muted && !c.mentioned ? 0 : c.unread), 0)
}
