import { Home } from "lucide-react"
import Link from "next/link"

/** Back to the welcome page. Sits in the flow of AuthShell, aligned with the content column. */
export function HomeButton() {
  return (
    <Link
      href="/"
      aria-label="Ana sayfa"
      title="Ana sayfa"
      className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-primary"
    >
      <Home className="size-[18px]" />
    </Link>
  )
}
