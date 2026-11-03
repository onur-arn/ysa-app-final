import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { I18nProvider } from "@/lib/i18n/context"
import { getLang } from "@/lib/i18n/server"
import { ThemeProvider } from "@/lib/theme/context"
import { SplashScreen } from "@/components/splash-screen"
import { Toaster } from "@/components/ui/toast"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const plusJakarta = Plus_Jakarta_Sans({ variable: "--font-plus-jakarta", subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"] })

export const metadata: Metadata = {
  title: { default: "YouthStation", template: "%s · YouthStation" },
  description: "YouthStation — iletişim, organizasyon ve dernek yönetimi.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YouthStation" },
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5fafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2330" },
  ],
}

// Applied before hydration to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('ys-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t);if(sessionStorage.getItem('ysa-splash'))document.documentElement.classList.add('no-splash');}catch(e){}})();`

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang()
  return (
    <html lang={lang} suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable}`}>
      <head>
        <Script id="theme" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body className="bg-background font-sans antialiased">
        <ThemeProvider>
          <SplashScreen />
          <I18nProvider initialLang={lang}>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
