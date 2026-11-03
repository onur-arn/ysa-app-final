"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"

/** Exact teal of the logo artwork */
const BRAND = "#67A2B2"

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: "easeOut" as const },
})

/**
 * First screen for signed-out visitors. The page is the same pure white as the
 * logo artwork (in light and dark mode) so the logo sits on it seamlessly.
 */
export function Welcome() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center bg-white px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
      style={{ colorScheme: "light" }}
    >
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="w-full"
        >
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
            <Image src="/youthstation-logo.jpg" alt="YouthStation" width={640} height={640} priority className="mx-auto h-auto w-full max-w-[20rem]" />
          </motion.div>
        </motion.div>

        <motion.div {...rise(0.3)} className="-mt-14 flex flex-col items-center gap-3 text-center">
          <span className="h-[3px] w-10 rounded-full" style={{ backgroundColor: BRAND, opacity: 0.35 }} />
          <p className="max-w-[20rem] text-[15px] leading-relaxed text-slate-500 text-pretty">
            Gençlik topluluğumuzun buluşma noktası
          </p>
        </motion.div>
      </div>

      <motion.div {...rise(0.5)} className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/auth/login"
          className="flex h-[52px] items-center justify-center rounded-2xl text-base font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: BRAND, boxShadow: `0 10px 24px -10px ${BRAND}` }}
        >
          Giriş yap
        </Link>
        <Link
          href="/auth/sign-up"
          className="flex h-[52px] items-center justify-center rounded-2xl border-2 text-base font-semibold transition-colors active:scale-[0.98]"
          style={{ borderColor: `${BRAND}55`, color: BRAND }}
        >
          Kayıt ol
        </Link>
        <p className="mt-3 text-center text-[11px] tracking-wide text-slate-400">Sadece üyelere özel erişim</p>
      </motion.div>
    </main>
  )
}
