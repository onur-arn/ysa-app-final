import type { Member } from "./types"

/** A soft-deleted account: kept for its name, but the person is gone. */
export const isDeleted = (m: { status?: string } | null | undefined) => m?.status === "deleted"

/** Struck-through grey italic styling for a deleted member's name. */
export const deletedClass = (m: { status?: string } | null | undefined) =>
  isDeleted(m) ? "line-through italic text-muted-foreground" : ""

/** Hide deleted accounts from directories and pickers (they cannot be interacted with). */
export const livingMembers = <T extends { status?: string }>(members: T[]) => members.filter((m) => !isDeleted(m))

export type { Member }
