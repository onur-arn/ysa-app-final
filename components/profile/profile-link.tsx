"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { ProfileSheet } from "@/components/profile/profile-sheet"
import { cn } from "@/lib/utils"

/** Opens a member's profile from anywhere (name or photo tapped). */
const OpenProfileContext = createContext<(id: string) => void>(() => {})
export const useOpenProfile = () => useContext(OpenProfileContext)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  const open = useCallback((member: string) => setId(member), [])
  return (
    <OpenProfileContext.Provider value={open}>
      {children}
      <ProfileSheet memberId={id} onClose={() => setId(null)} />
    </OpenProfileContext.Provider>
  )
}

/** Tappable name or photo: opens the profile without triggering the surrounding element. */
export function ProfileLink({ id, children, className, before }: { id: string | null | undefined; children: ReactNode; className?: string; before?: () => void }) {
  const open = useOpenProfile()
  if (!id) return <>{children}</>
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); before?.(); open(id) }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); before?.(); open(id) } }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </span>
  )
}
