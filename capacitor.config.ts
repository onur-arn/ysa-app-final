import type { CapacitorConfig } from "@capacitor/cli"

/**
 * YouthStation iOS/Android wrapper. The native app loads the hosted Next.js site
 * (server.url) inside a WebView — the live app, with native capabilities (push,
 * splash) added through Capacitor. Change `appId` to the bundle identifier you
 * register in your Apple Developer account.
 */
const config: CapacitorConfig = {
  appId: "org.youthstation.ysa",
  appName: "YouthStation",
  webDir: "www",
  server: {
    url: "https://app.youthstation.org",
    cleartext: false,
  },
  // Same white as the app, behind the page while the keyboard opens.
  backgroundColor: "#ffffff",
  plugins: {
    // "native" shrinks the WebView to the space above the keyboard: nothing shows in between.
    Keyboard: { resize: "native", style: "LIGHT" },
  },
  ios: {
    // The site already pads itself with env(safe-area-inset-*), as it does as a PWA.
    contentInset: "never",
  },
}

export default config
