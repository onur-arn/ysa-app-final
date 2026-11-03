import Image from "next/image"
import Link from "next/link"

/** Exact teal of the logo artwork */
const BRAND = "#67A2B2"

/**
 * First screen for signed-out visitors. Static on purpose (no animation): the
 * page is the same pure white as the logo artwork so the logo sits on it
 * seamlessly, with the slogan always visible below it.
 */
export function Welcome() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center bg-white px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
      style={{ colorScheme: "light" }}
    >
      {/* logo in the upper third, the slogan right below it */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center pt-[9vh]">
        <Image src="/youthstation-logo.jpg" alt="YouthStation" width={640} height={640} priority className="mx-auto h-auto w-full max-w-[20rem]" />
        <div className="-mt-14 flex flex-col items-center gap-3 text-center">
          <span className="h-[3px] w-10 rounded-full" style={{ backgroundColor: BRAND, opacity: 0.35 }} />
          <p className="font-heading text-xl font-bold tracking-tight" style={{ color: BRAND }}>
            Gençlerden, gençler için
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/auth/login"
          className="flex h-12 items-center justify-center rounded-2xl text-base font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: BRAND, boxShadow: `0 10px 24px -10px ${BRAND}` }}
        >
          Giriş yap
        </Link>
        <Link
          href="/auth/sign-up"
          className="flex h-12 items-center justify-center rounded-2xl border-2 text-base font-semibold transition-transform active:scale-[0.98]"
          style={{ borderColor: `${BRAND}55`, color: BRAND }}
        >
          Kayıt ol
        </Link>
        <p className="mt-3 text-center text-[11px] tracking-wide text-slate-400">Sadece yöneticilere özel erişim</p>
      </div>
    </main>
  )
}
