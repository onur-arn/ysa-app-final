"use client"

import { PhoneCall } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { telUrl } from "@/lib/phone"
import { cn } from "@/lib/utils"

/** Call button (chat header / profile): tapping it places a normal phone call. */
export function PhoneButton({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const { t } = useI18n()
  const tel = telUrl(phone)

  if (!tel) {
    return (
      <span className={cn("flex size-10 items-center justify-center rounded-full text-muted-foreground/40", className)} title={t("phone.none")}>
        <PhoneCall className="size-5" />
      </span>
    )
  }

  return (
    <a
      href={tel}
      aria-label={t("phone.call")}
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-primary transition-transform hover:bg-primary/10 active:scale-95", className)}
    >
      <PhoneCall className="size-5" />
    </a>
  )
}
