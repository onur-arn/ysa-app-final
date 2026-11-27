"use client"

/**
 * iOS keeps the "Now Playing" banner (lock screen, Control Centre) as long as an audio
 * element still holds a loaded source — even paused. Every player of the app registers
 * here and is fully released (source unloaded) when it ends, when its screen closes and
 * when the app goes to the background, so nothing is left behind like a radio.
 */
const players = new Set<HTMLAudioElement>()

export function trackAudio(el: HTMLAudioElement) {
  players.add(el)
  el.addEventListener("ended", onEnded)
  return () => {
    el.removeEventListener("ended", onEnded)
    releaseAudio(el)
    players.delete(el)
  }
}

function onEnded(e: Event) {
  releaseAudio(e.currentTarget as HTMLAudioElement)
}

export function releaseAudio(el: HTMLAudioElement | null | undefined) {
  if (!el) return
  try {
    el.pause()
    if (el.getAttribute("src") || el.src) {
      el.removeAttribute("src")
      el.load()   // drops the media: iOS closes the Now Playing session
    }
  } catch {
    // already released
  }
  clearNowPlaying()
}

export function releaseAllAudio() {
  players.forEach((el) => releaseAudio(el))
}

function clearNowPlaying() {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined
  if (!ms) return
  try {
    ms.metadata = null
    ms.playbackState = "none"
  } catch {
    // not supported
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") releaseAllAudio()
  })
  window.addEventListener("pagehide", releaseAllAudio)
}
