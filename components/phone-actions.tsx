"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Phone } from "lucide-react"
import { useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { telUrl, whatsappUrl } from "@/lib/phone"
import { cn } from "@/lib/utils"

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3l-.5-.2Z" />
    </svg>
  )
}

/**
 * The 📞 button (top-right of a chat, profile sheet): opens a small menu with
 * a WhatsApp link (chat/call in WhatsApp) and a regular phone call.
 */
export function PhoneButton({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const wa = whatsappUrl(phone)
  const tel = telUrl(phone)
  if (!wa && !tel) {
    return (
      <span className={cn("flex size-10 items-center justify-center rounded-full text-muted-foreground/40", className)} title={t("phone.none")}>
        <Phone className="size-5" />
      </span>
    )
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={cn("flex size-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10", className)} aria-label={t("phone.call")}>
        <Phone className="size-5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-2xl"
            >
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary">
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#25D366] text-white"><WhatsAppIcon className="size-5" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">WhatsApp</span>
                    <span className="block text-[11px] text-muted-foreground">{t("phone.whatsappHint")}</span>
                  </span>
                </a>
              )}
              {tel && (
                <a href={tel} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Phone className="size-4" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{t("phone.call")}</span>
                    <span className="block text-[11px] text-muted-foreground">{phone}</span>
                  </span>
                </a>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
