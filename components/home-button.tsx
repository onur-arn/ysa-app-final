import { Home } from "lucide-react"
import Link from "next/link"

/** Top-left button on the auth screens: back to the welcome page. */
export function HomeButton() {
  return (
    <Link
      href="/"
      aria-label="Ana sayfa"
      title="Ana sayfa"
      className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-primary"
    >
      <Home className="size-[18px]" />
    </Link>
  )
}
