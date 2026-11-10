import { BOARD_POSITIONS } from "./constants"
import type { Profile } from "./types"

type Who = Pick<Profile, "id" | "app_role" | "station_id" | "position"> | null | undefined

export const isAdmin = (me: Who) => me?.app_role === "admin"

/** Yönetim Kurulu of Uluslararası Büro (or a platform admin) — mirrors public.is_board().
 *  Its Yürütme Kurulu has the rights of an ordinary station member. */
export const isBoard = (me: Who) =>
  !!me && (me.app_role === "admin" || (me.station_id === "intl" && (BOARD_POSITIONS as readonly string[]).includes(me.position ?? "")))

/** The central office powers (all stations, pins, positions) — mirrors public.is_intl(), same as isBoard */
export const isIntl = isBoard

/** "Misafir giriş" accounts: no station, read-mostly (cannot create station tasks/events) */
export const isGuest = (me: Who) => !!me && !me.station_id && me.app_role !== "admin"

/** Members create tasks/events for their own station; intl for any */
export const canTargetStation = (me: Who, stationId: string | null | undefined) => isIntl(me) || stationId === me?.station_id
