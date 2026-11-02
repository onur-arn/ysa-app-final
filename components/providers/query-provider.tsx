"use client"

import { QueryClient } from "@tanstack/react-query"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { useState, type ReactNode } from "react"

/**
 * One cache for the whole app, persisted in localStorage: reopening the PWA
 * shows the last known feed / chats instantly, then the realtime hub and a
 * background refetch bring them up to date.
 */
export function QueryProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Realtime keeps data fresh, so cached data is trusted for a while.
            staleTime: 5 * 60_000,
            gcTime: 24 * 3600_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )
  const [persister] = useState(() =>
    createSyncStoragePersister({ storage: typeof window === "undefined" ? undefined : window.localStorage, key: "ysa-cache", throttleTime: 1500 }),
  )
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        buster: userId, // another account on the same device never sees this cache
        maxAge: 24 * 3600_000,
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" && q.queryKey[0] !== "notifications" },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
