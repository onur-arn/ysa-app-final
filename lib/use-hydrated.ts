"use client"

import { useSyncExternalStore } from "react"

const noop = () => () => {}

/**
 * false while React hydrates server HTML, true right after (and immediately for
 * components mounted later). Lets cached data show without hydration mismatches:
 * the cache may already be filled (localStorage restore, hub prefetch) when a
 * lazily hydrated page segment hydrates, but the server rendered it empty.
 */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false)
}
