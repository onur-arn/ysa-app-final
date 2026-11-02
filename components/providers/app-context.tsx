"use client"

import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { qk } from "@/lib/data/keys"
import { fetchMe } from "@/lib/data/fetchers"
import { useHydrated } from "@/lib/use-hydrated"
import type { Member, Profile, Station } from "@/lib/types"

type AppContextType = {
  me: Profile
  stations: Station[]
  initialMembers: Member[]
  station: (id: string | null | undefined) => Station | undefined
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ me: initialMe, stations, initialMembers, children }: { me: Profile; stations: Station[]; initialMembers: Member[]; children: ReactNode }) {
  // "me" lives in the cache too, so profile edits/approvals show up live.
  const { data: cachedMe } = useQuery({ queryKey: qk.me, queryFn: () => fetchMe(initialMe.id), initialData: initialMe, initialDataUpdatedAt: 0 })
  const me = useHydrated() ? cachedMe : initialMe
  const value = useMemo<AppContextType>(() => {
    const map = new Map(stations.map((s) => [s.id, s]))
    return { me: me ?? initialMe, stations, initialMembers, station: (id) => (id ? map.get(id) : undefined) }
  }, [me, initialMe, stations, initialMembers])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
