/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "localhost"

const isDev = process.env.NODE_ENV !== "production"

// Content-Security-Policy. Pragmatic: Next.js injects inline scripts/styles, so script/style
// keep 'unsafe-inline' (and 'unsafe-eval' in dev for the bundler). The real wins are the locked
// object-src/base-uri/form-action/frame-ancestors and the explicit connect/img/media sources.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' blob: data: https://${supabaseHost} wss://${supabaseHost} https://*.supabase.co wss://*.supabase.co https://raw.githubusercontent.com https://cdn.jsdelivr.net https://geocoding-api.open-meteo.com${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // only in production: on http://localhost it would upgrade dev/HMR requests to https and break them
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const nextConfig = {
  // Dev only: lets a phone on the same Wi-Fi open the dev server (http://192.168.x.x:3000).
  // Without it Next.js 16 answers 403 to its own JS/CSS chunks and pages render unstyled.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Lets a verification build run next to `next dev` without touching its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
