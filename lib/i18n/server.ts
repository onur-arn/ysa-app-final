import { DEFAULT_LANG, type Lang } from "./config"

/** The app is Turkish only. */
export async function getLang(): Promise<Lang> {
  return DEFAULT_LANG
}
