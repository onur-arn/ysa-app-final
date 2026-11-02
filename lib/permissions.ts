import type { Profile } from "./types"

type Who = Pick<Profile, "id" | "app_role" | "station_id"> | null | undefined

export const isAdmin = (me: Who) => me?.app_role === "admin"

/** Uluslararası Büro (or a platform admin) — mirrors public.is_intl() */
export const isIntl = (me: Who) => !!me && (me.station_id === "intl" || me.app_role === "admin")

/** Members create tasks/events for their own station; intl for any */
export const canTargetStation = (me: Who, stationId: string | null | undefined) => isIntl(me) || stationId === me?.station_id
