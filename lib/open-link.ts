"use client"

const APP_HOSTS = new Set(["app.youthstation.org"])

/** Detects web links in a text: http(s)://… and www.… (trailing punctuation left out). */
export const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}»]/gi

export function normalizeUrl(raw: string) {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

/**
 * Opens a link from a message or a post:
 * - YouthStation's own pages → in-app navigation;
 * - anything else → the user's default browser (Safari on iPhone), new tab on the web.
 */
export async function openLink(raw: string, navigate: (path: string) => void) {
  const url = normalizeUrl(raw)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (APP_HOSTS.has(parsed.hostname) || parsed.origin === window.location.origin) {
    return navigate(`${parsed.pathname}${parsed.search}${parsed.hash}` || "/")
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
