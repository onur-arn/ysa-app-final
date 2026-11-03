"use client"

import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"

const KEY = "ysa-splash"

/**
 * Animated YouthStation logo on start-up (v1 design). Shown once per session:
 * the inline script in the root layout adds `.no-splash` before paint when it
 * has already been seen, so refreshes are not slowed down.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (document.documentElement.classList.contains("no-splash")) return setVisible(false)
    try { sessionStorage.setItem(KEY, "1") } catch {}
    const t = setTimeout(() => setVisible(false), 1700)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="splash"
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg, #0d2028 0%, #0e2a33 60%, #0b1e27 100%)" }}
        >
          <div className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" style={{ backgroundColor: "rgba(91,158,181,0.22)" }} />
          <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }} className="relative mb-5">
            <motion.div
              animate={{ opacity: [0.25, 0.5, 0.25], scale: [1.15, 1.3, 1.15] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-[24px] blur-2xl"
              style={{ backgroundColor: "rgba(91,158,181,0.45)" }}
            />
            <div className="relative overflow-hidden rounded-[22px] bg-white p-3" style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>
              <Image src="/youthstation-logo.jpg" alt="YouthStation" width={96} height={96} className="block object-contain" priority />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }} className="flex flex-col items-center gap-1.5">
            <p className="font-heading text-2xl font-bold tracking-[-0.01em] text-white">Youth<span style={{ color: "#5B9EB5" }}>Station</span></p>
            <p className="text-[11px] uppercase" style={{ color: "rgba(91,158,181,0.65)", letterSpacing: "0.18em" }}>Gençlik Topluluğu</p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.3 }} className="absolute bottom-16 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-1.5 rounded-full" style={{ backgroundColor: "rgba(91,158,181,0.6)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
