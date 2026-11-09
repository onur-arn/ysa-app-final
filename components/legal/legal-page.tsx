import Link from "next/link"
import type { ReactNode } from "react"

export const CONTACT_EMAIL = "secretaire@youthstation.org"

/** Public legal pages, hosted apart from the app (this is the URL given to the App Store). */
export const PRIVACY_URL = "https://ysa-privacy-policy.vercel.app"
export const TERMS_URL = "https://ysa-privacy-policy.vercel.app/kosullar"

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-background px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-sm leading-relaxed text-foreground">
      <Link href="/" className="text-sm font-semibold text-primary">← YouthStation</Link>
      <h1 className="mt-5 font-heading text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{updated}</p>
      <div className="mt-5 flex flex-col gap-3 [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </main>
  )
}
