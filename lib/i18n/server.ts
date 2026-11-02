import { cookies } from "next/headers"
import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "./config"

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value
  return isLang(v) ? v : DEFAULT_LANG
}
