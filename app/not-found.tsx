import Link from "next/link"
import { Logo } from "@/components/logo"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size={56} />
      <h1 className="font-heading text-3xl font-bold text-foreground">404</h1>
      <Link href="/feed" className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">← YouthStation</Link>
    </main>
  )
}
