"use client"

import { AnimatePresence, motion, type PanInfo } from "framer-motion"
import { Share2, X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useI18n } from "@/lib/i18n/context"

/**
 * Full-screen photo viewer inside the app (instead of opening the Supabase URL in Safari).
 * Double-tap to zoom, drag to move when zoomed, swipe down to close.
 */
type Ctx = { open: (src: string) => void }
const ViewerContext = createContext<Ctx>({ open: () => {} })

export const useImageViewer = () => useContext(ViewerContext)

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null)
  const open = useCallback((s: string) => setSrc(s), [])
  return (
    <ViewerContext.Provider value={{ open }}>
      {children}
      <ImageViewer src={src} onClose={() => setSrc(null)} />
    </ViewerContext.Provider>
  )
}

function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const [zoom, setZoom] = useState(false)
  const lastTap = useState({ at: 0 })[0]

  useEffect(() => {
    if (!src) return
    setZoom(false)
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [src, onClose])

  function onTap() {
    const now = Date.now()
    if (now - lastTap.at < 280) setZoom((z) => !z)
    lastTap.at = now
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!zoom && (info.offset.y > 120 || info.velocity.y > 600)) onClose()
  }

  async function share() {
    if (!src) return
    try {
      const blob = await fetch(src).then((r) => r.blob())
      const file = new File([blob], `youthstation-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
      else await navigator.share?.({ url: src })
    } catch {
      // partage annulé ou indisponible : rien à faire
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button onClick={onClose} className="flex size-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur" aria-label={t("common.close")}>
              <X className="size-5" />
            </button>
            {canShare && (
              <button onClick={share} className="flex size-10 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur" aria-label={t("common.share")}>
                <Share2 className="size-5" />
              </button>
            )}
          </div>
          <motion.img
            key={src}
            src={src}
            alt=""
            draggable={false}
            onClick={onTap}
            drag={zoom ? true : "y"}
            dragConstraints={zoom ? { left: -400, right: 400, top: -400, bottom: 400 } : { top: 0, bottom: 0 }}
            dragElastic={zoom ? 0.2 : 0.6}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: zoom ? 2.2 : 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="max-h-full max-w-full touch-none object-contain"
            style={{ WebkitTouchCallout: "none" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
