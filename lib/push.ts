"use client"

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register("/sw.js")
  } catch {
    return null
  }
}

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window

/** Ask permission and store the push subscription (Ayarlar → Bildirimler). */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported" | "unconfigured"> {
  if (!pushSupported()) return "unsupported"
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return "denied"
  const { key } = (await fetch("/api/push/vapid-key").then((r) => r.json())) as { key?: string }
  if (!key) return "unconfigured"
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
  await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) })
  return "granted"
}

export async function disablePush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) })
  await sub.unsubscribe()
}

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

/**
 * Ask the server to deliver pending notifications as push messages.
 * Called after any action that notifies other people (message, task, event…).
 * It only ever sends notifications that the database itself created.
 */
export function dispatchPush() {
  void fetch("/api/push/dispatch", { method: "POST", keepalive: true }).catch(() => {})
}
