"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Download, Loader2, Minus, Plus, Share2, X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useI18n } from "@/lib/i18n/context"
import { downloadFile, signedFileUrl } from "@/lib/upload"

/**
 * Full-screen PDF reader inside the app (like the photo viewer): the document is fetched
 * from the private bucket and drawn page by page with pdf.js, instead of opening a
 * Supabase link in Safari.
 */
type Doc = { path: string; name: string }
type Ctx = { open: (doc: Doc) => void }
const PdfContext = createContext<Ctx>({ open: () => {} })
export const usePdfViewer = () => useContext(PdfContext)

export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<Doc | null>(null)
  const open = useCallback((d: Doc) => setDoc(d), [])
  return (
    <PdfContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>{doc && <PdfViewer key={doc.path} doc={doc} onClose={() => setDoc(null)} />}</AnimatePresence>
    </PdfContext.Provider>
  )
}

type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> }
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void }
}

async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
  return (await pdfjs.getDocument({ data, isEvalSupported: false, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise) as unknown as PdfDocument
}

const ZOOMS = [1, 1.5, 2, 3]

function PdfViewer({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { t } = useI18n()
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(0)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    let loaded: PdfDocument | null = null
    ;(async () => {
      try {
        const res = await fetch(await signedFileUrl(doc.path))
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.arrayBuffer()
        if (!alive) return
        setBytes(data.slice(0))
        loaded = await loadPdf(data)
        if (alive) setPdf(loaded)
        else void loaded.destroy()
      } catch {
        if (alive) setError(true)
      }
    })()
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      alive = false
      void loaded?.destroy()
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [doc.path, onClose])

  async function share() {
    try {
      if (bytes) {
        const file = new File([bytes], doc.name, { type: "application/pdf" })
        if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] })
      }
      await downloadFile(doc.path, doc.name)
    } catch {
      // partage annulé
    }
  }

  function onScroll() {
    const el = scroller.current
    if (!el || !pdf) return
    const pages = Array.from(el.querySelectorAll<HTMLElement>("[data-page]"))
    const mid = el.scrollTop + el.clientHeight / 3
    let current = 1
    for (const p of pages) if (p.offsetTop <= mid) current = Number(p.dataset.page)
    setPage(current)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-neutral-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-center gap-2 bg-neutral-900/95 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12" aria-label={t("common.close")}>
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{doc.name}</p>
          {pdf && <p className="text-[11px] text-white/60">{t("files.page", { n: page, total: pdf.numPages })}</p>}
        </div>
        <button onClick={share} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12" aria-label={t("common.share")}>
          {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="size-5" /> : <Download className="size-5" />}
        </button>
      </div>

      <div ref={scroller} onScroll={onScroll} className="relative flex-1 overflow-auto overscroll-contain">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
            <p className="text-sm">{t("files.pdfError")}</p>
            <button onClick={() => void downloadFile(doc.path, doc.name)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">{t("files.download")}</button>
          </div>
        ) : !pdf ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="size-7 animate-spin text-white/70" /></div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 py-3" style={{ width: `${ZOOMS[zoom] * 100}%` }}>
            {Array.from({ length: pdf.numPages }, (_, i) => <PdfPageView key={i} pdf={pdf} n={i + 1} zoom={ZOOMS[zoom]} root={scroller} />)}
          </div>
        )}
      </div>

      {pdf && (
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex overflow-hidden rounded-full bg-white/15 text-white backdrop-blur">
          <button onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} className="flex size-11 items-center justify-center disabled:opacity-40" aria-label="zoom out"><Minus className="size-5" /></button>
          <button onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} className="flex size-11 items-center justify-center disabled:opacity-40" aria-label="zoom in"><Plus className="size-5" /></button>
        </div>
      )}
    </motion.div>
  )
}

/** One page, drawn only once it comes close to the screen (long documents stay light). */
function PdfPageView({ pdf, n, zoom, root }: { pdf: PdfDocument; n: number; zoom: number; root: React.RefObject<HTMLDivElement | null> }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = useState(1.414)
  const [visible, setVisible] = useState(n <= 2)

  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { root: root.current, rootMargin: "800px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [root])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    void (async () => {
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      if (cancelled) return
      setRatio(base.height / base.width)
      const cssWidth = box.current?.clientWidth || base.width
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // keep the canvas under ~16 M pixels (iOS refuses bigger ones)
      const scale = Math.min((cssWidth / base.width) * dpr, Math.sqrt(16e6 / (base.width * base.height)))
      const viewport = page.getViewport({ scale })
      const c = canvas.current
      if (!c || cancelled) return
      c.width = Math.floor(viewport.width)
      c.height = Math.floor(viewport.height)
      const job = page.render({ canvasContext: c.getContext("2d")!, viewport })
      task = job
      await job.promise
    })().catch(() => {})
    return () => { cancelled = true; task?.cancel() }
  }, [visible, pdf, n, zoom])

  return (
    <div ref={box} data-page={n} className="w-full bg-white shadow-lg" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  )
}
