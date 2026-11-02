// YouthStation service worker — push notifications only (no offline caching).
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    return
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // The open app already shows its own in-app banner: avoid a duplicate alert.
      if (list.some((c) => c.visibilityState === "visible")) return
      return self.registration.showNotification(data.title || "YouthStation", {
      body: data.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: data.tag,
      renotify: !!data.tag,
      vibrate: [100, 50, 100],
      data: { url: data.url || "/feed" },
      })
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/feed"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    }),
  )
})
