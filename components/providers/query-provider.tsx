"use client"

import { QueryClient } from "@tanstack/react-query"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { useEffect, useState, type ReactNode } from "react"

/**
 * framer-motion 12.x throws "Failed to execute releasePointerCapture … the object
 * can not be found here" on touch devices when a gesture element releases a pointer
 * it no longer holds (e.g. layout/menu re-render mid-tap). In dev this pops the error
 * overlay and blocks sending messages on the phone. Guard the call so it only runs
 * when the pointer really is captured — a semantic no-op otherwise.
 */
function usePointerCaptureGuard() {
  useEffect(() => {
    const proto = Element.prototype as Element & { __ysaPointerPatched?: boolean }
    if (proto.__ysaPointerPatched) return
    const orig = proto.releasePointerCapture
    proto.releasePointerCapture = function (pointerId: number) {
      try {
        if (this.hasPointerCapture?.(pointerId)) orig.call(this, pointerId)
      } catch {
        /* ignore: nothing to release */
      }
    }
    proto.__ysaPointerPatched = true
  }, [])
}

/**
 * One cache for the whole app, persisted in localStorage: reopening the PWA
 * shows the last known feed / chats instantly, then the realtime hub and a
 * background refetch bring them up to date.
 */
export function QueryProvider({ userId, children }: { userId: string; children: ReactNode }) {
  usePointerCaptureGuard()
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
