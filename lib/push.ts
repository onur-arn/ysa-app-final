"use client"

import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

/** True inside the iOS app. Its WebView has no Web Push, so notifications go through APNs. */
export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform()

const NATIVE_PREF = "ysa-native-push"   // "on" | "off", absent until the member has been asked
const readPref = () => { try { return localStorage.getItem(NATIVE_PREF) } catch { return null } }
const writePref = (v: "on" | "off") => { try { localStorage.setItem(NATIVE_PREF, v) } catch {} }
let nativeToken: string | null = null
let nativeReady = false

function requestNativeToken() {
  return new Promise<string | null>((resolve) => {
    void (async () => {
      const timer = setTimeout(() => done(null), 15_000)
      const handles = await Promise.all([
        PushNotifications.addListener("registration", (t) => done(t.value)),
        PushNotifications.addListener("registrationError", () => done(null)),
      ])
      function done(token: string | null) {
        clearTimeout(timer)
        handles.forEach((h) => void h.remove())
        resolve(token)
      }
      await PushNotifications.register()
    })()
  })
}

async function linkNativeDevice() {
  nativeToken = await requestNativeToken()
  if (!nativeToken) return false
  const res = await fetch("/api/push/native", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: nativeToken }) })
  return res.ok
}

async function enableNativePush(): Promise<"granted" | "denied" | "unconfigured"> {
  const { receive } = await PushNotifications.requestPermissions()
  if (receive !== "granted") {
    writePref("off")
    return "denied"
  }
  if (!(await linkNativeDevice())) return "unconfigured"
  writePref("on")
  return "granted"
}

/** Called when the signed-in app opens: routes taps on notifications and keeps the token fresh. */
export async function initNativePush() {
  if (!isNativeApp() || nativeReady) return
  nativeReady = true
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = (notification.data as { url?: unknown } | undefined)?.url
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) window.location.assign(url)
  })
  const pref = readPref()
  if (pref === "off") return
  if (pref === null) return void (await enableNativePush())
  if ((await PushNotifications.checkPermissions()).receive === "granted") await linkNativeDevice()
}

/** On logout: this phone must stop receiving the member's notifications. */
export async function unlinkNativeDevice() {
  if (!isNativeApp() || !nativeToken) return
  await fetch("/api/push/native", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: nativeToken }) }).catch(() => {})
  nativeToken = null
}

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

export const pushSupported = () => isNativeApp() || typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window

/** Ask permission and store the push subscription (Ayarlar → Bildirimler). */
export async function enablePush(): Promise<"granted" | "denied" | "unsupported" | "unconfigured"> {
  if (isNativeApp()) return enableNativePush()
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
  if (isNativeApp()) {
    writePref("off")
    return unlinkNativeDevice()
  }
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) })
  await sub.unsubscribe()
}

export async function pushEnabled() {
  if (isNativeApp()) return readPref() === "on" && (await PushNotifications.checkPermissions()).receive === "granted"
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
