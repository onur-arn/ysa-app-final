"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Check, Expand, Loader2, Minimize2, Music, Pause, Play, Search, Trash2, Type, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Story editor — one screen, no modes to learn:
 *   tap the photo (or "Aa") to write · drag a text to move it · pinch to resize
 *   double-tap a text to edit it · drop it on the bin to delete it
 *   swipe the filter row at the bottom · add music · "Paylaş".
 * The frame is a fixed 9:16 canvas so what you see is exactly what is published.
 */

const FILTERS = [
  { name: "Normal", value: "none" },
  { name: "Sıcak", value: "sepia(0.3) saturate(1.4) brightness(1.05)" },
  { name: "Soğuk", value: "saturate(0.85) hue-rotate(20deg) brightness(1.05)" },
  { name: "Canlı", value: "saturate(1.8) contrast(1.1)" },
  { name: "S/B", value: "grayscale(1) contrast(1.1)" },
  { name: "Vintage", value: "sepia(0.5) contrast(0.85) brightness(0.9)" },
  { name: "Parlak", value: "brightness(1.18) contrast(1.05)" },
]
const COLORS = ["#ffffff", "#111111", "#facc15", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"]
const FONTS = ["-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "Georgia, serif", "'Courier New', monospace", "Impact, fantasy"]
const OUT_W = 1080
const OUT_H = 1920

type Layer = { id: string; text: string; color: string; boxed: boolean; font: number; size: number; x: number; y: number }
type Track = { id: number; title: string; artist: { name: string }; album: { cover_small: string }; preview: string }

export function StoryEditor({
  imageUrl,
  onCancel,
  onPublish,
}: {
  imageUrl: string
  onCancel: () => void
  onPublish: (flatUrl: string, fitMode: "cover" | "contain", musicPreviewUrl?: string, musicLabel?: string) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState("none")
  const [fit, setFit] = useState<"cover" | "contain">("cover")
  const [layers, setLayers] = useState<Layer[]>([])
  const [editing, setEditing] = useState<Layer | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overBin, setOverBin] = useState(false)
  const [music, setMusic] = useState<{ url: string; label: string } | null>(null)
  const [musicOpen, setMusicOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const gesture = useRef<{ id: string; pointers: Map<number, { x: number; y: number }>; start: { x: number; y: number; lx: number; ly: number; dist: number; size: number }; moved: boolean } | null>(null)
  const lastTap = useRef<{ id: string; at: number } | null>(null)
  const [frameW, setFrameW] = useState(360)

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Landscape photos are shown whole by default, portrait ones fill the frame.
  useEffect(() => {
    const img = new Image()
    img.onload = () => setFit(img.naturalWidth > img.naturalHeight ? "contain" : "cover")
    img.src = imageUrl
  }, [imageUrl])

  // positions are stored as fractions of the frame (0–1) so the export is resolution independent
  const frameRect = () => frameRef.current!.getBoundingClientRect()

  function newText(at?: { x: number; y: number }) {
    setEditing({ id: `t-${Date.now()}`, text: "", color: "#ffffff", boxed: true, font: 0, size: 0.065, x: at?.x ?? 0.5, y: at?.y ?? 0.42 })
  }

  function commitText() {
    if (!editing) return
    const text = editing.text.trim()
    setLayers((ls) => {
      const rest = ls.filter((l) => l.id !== editing.id)
      return text ? [...rest, { ...editing, text }] : rest
    })
    setEditing(null)
  }

  // ── gestures on a text layer: drag, pinch, double-tap, drop on bin ──
  function onDown(e: React.PointerEvent, l: Layer) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const g = gesture.current?.id === l.id ? gesture.current : { id: l.id, pointers: new Map(), start: { x: 0, y: 0, lx: l.x, ly: l.y, dist: 0, size: l.size }, moved: false }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...g.pointers.values()]
    g.start = { x: pts[0].x, y: pts[0].y, lx: l.x, ly: l.y, size: l.size, dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 }
    gesture.current = g
    setDragId(l.id)
  }

  function onMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const r = frameRect()
    const pts = [...g.pointers.values()]
    if (pts.length > 1 && g.start.dist) {
      const scale = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.start.dist
      setLayers((ls) => ls.map((l) => (l.id === g.id ? { ...l, size: Math.min(0.2, Math.max(0.03, g.start.size * scale)) } : l)))
      g.moved = true
      return
    }
    const dx = (pts[0].x - g.start.x) / r.width
    const dy = (pts[0].y - g.start.y) / r.height
    if (Math.abs(dx) + Math.abs(dy) > 0.01) g.moved = true
    setLayers((ls) => ls.map((l) => (l.id === g.id ? { ...l, x: g.start.lx + dx, y: g.start.ly + dy } : l)))
    setOverBin(pts[0].y > r.bottom - 110 && Math.abs(pts[0].x - (r.left + r.width / 2)) < 70)
  }

  function onUp(e: React.PointerEvent, l: Layer) {
    const g = gesture.current
    if (!g) return
    g.pointers.delete(e.pointerId)
    if (g.pointers.size) return
    gesture.current = null
    setDragId(null)
    if (overBin) {
      setLayers((ls) => ls.filter((x) => x.id !== l.id))
      setOverBin(false)
      return
    }
    if (!g.moved) {
      const now = Date.now()
      if (lastTap.current?.id === l.id && now - lastTap.current.at < 350) setEditing(l)
      lastTap.current = { id: l.id, at: now }
    }
  }

  function onFrameTap(e: React.MouseEvent) {
    if (editing) return commitText()
    const r = frameRect()
    newText({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  // ── export: draw the 9:16 frame at 1080×1920 ──
  async function publish() {
    setPublishing(true)
    const canvas = document.createElement("canvas")
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    await new Promise((r) => (img.onload = r))
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    if (filter !== "none") ctx.filter = filter
    const scale = (fit === "cover" ? Math.max : Math.min)(OUT_W / img.naturalWidth, OUT_H / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    ctx.drawImage(img, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh)
    ctx.filter = "none"
    for (const l of layers) {
      const px = l.size * OUT_W
      ctx.font = `bold ${px}px ${FONTS[l.font]}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const x = l.x * OUT_W
      const y = l.y * OUT_H
      if (l.boxed) {
        const w = ctx.measureText(l.text).width + px * 0.8
        const h = px * 1.45
        ctx.fillStyle = l.color === "#ffffff" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)"
        ctx.beginPath()
        ctx.roundRect(x - w / 2, y - h / 2, w, h, px * 0.3)
        ctx.fill()
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.55)"
        ctx.shadowBlur = px * 0.25
      }
      ctx.fillStyle = l.color
      ctx.fillText(l.text, x, y)
      ctx.shadowBlur = 0
    }
    // The composition is baked into the image, so the viewer shows it whole.
    onPublish(canvas.toDataURL("image/jpeg", 0.9), "contain", music?.url, music?.label)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black">
      {/* 9:16 frame */}
      <div ref={frameRef} onClick={onFrameTap} className="relative aspect-[9/16] max-h-[calc(100dvh-9rem)] w-full max-w-[min(100vw,calc((100dvh-9rem)*9/16))] overflow-hidden rounded-2xl bg-neutral-900 md:rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" draggable={false} className="size-full select-none" style={{ filter, objectFit: fit }} />

        {layers.filter((l) => l.id !== editing?.id).map((l) => (
          <div
            key={l.id}
            onPointerDown={(e) => onDown(e, l)}
            onPointerMove={onMove}
            onPointerUp={(e) => onUp(e, l)}
            onPointerCancel={(e) => onUp(e, l)}
            onClick={(e) => e.stopPropagation()}
            className={cn("absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none whitespace-nowrap font-bold transition-transform", dragId === l.id && "scale-105", dragId === l.id && overBin && "scale-50 opacity-60")}
            style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}
          >
            <TextChip layer={l} frameW={frameW} />
          </div>
        ))}

        {/* bin while dragging */}
        <AnimatePresence>
          {dragId && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <span className={cn("flex size-14 items-center justify-center rounded-full border-2 text-white backdrop-blur transition-all", overBin ? "scale-125 border-red-500 bg-red-500" : "border-white/70 bg-black/40")}>
                <Trash2 className="size-6" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top bar */}
        {!editing && !dragId && (
          <>
            {/* below the status bar: on iPhone the canvas runs under the clock and battery icons */}
            <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)]" onClick={(e) => e.stopPropagation()}>
              <RoundButton onClick={onCancel} label="Kapat"><X className="size-5" /></RoundButton>
            </div>
            <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <RoundButton onClick={() => setFit((f) => (f === "cover" ? "contain" : "cover"))} label={fit === "cover" ? "Sığdır" : "Doldur"}>
                {fit === "cover" ? <Minimize2 className="size-5" /> : <Expand className="size-5" />}
              </RoundButton>
              <RoundButton onClick={() => setMusicOpen(true)} label="Müzik" active={!!music}><Music className="size-5" /></RoundButton>
              <RoundButton onClick={() => newText()} label="Yazı"><Type className="size-5" /></RoundButton>
            </div>
          </>
        )}

        {music && !editing && !dragId && (
          <button onClick={(e) => { e.stopPropagation(); setMusicOpen(true) }} className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] flex max-w-[60%] -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <Music className="size-3.5 shrink-0" /> <span className="truncate">{music.label}</span>
          </button>
        )}

        {layers.length === 0 && !editing && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm font-medium text-white/70 drop-shadow">Yazı eklemek için dokun</p>
        )}

        {/* inline text editor */}
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { e.stopPropagation(); commitText() }} className="absolute inset-0 flex flex-col bg-black/55 backdrop-blur-[2px]">
              <div className="flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditing({ ...editing, boxed: !editing.boxed })} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
                  {editing.boxed ? "Arka plan: açık" : "Arka plan: kapalı"}
                </button>
                <button onClick={() => setEditing({ ...editing, font: (editing.font + 1) % FONTS.length })} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white" style={{ fontFamily: FONTS[editing.font] }}>Aa</button>
                <button onClick={commitText} className="flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-black"><Check className="size-3.5" /> Tamam</button>
              </div>
              <div className="flex flex-1 items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && commitText()}
                  placeholder="Bir şey yaz…"
                  maxLength={60}
                  className="w-full bg-transparent text-center font-bold text-white outline-none placeholder:text-white/40"
                  style={{ fontFamily: FONTS[editing.font], color: editing.color, fontSize: Math.min(44, editing.size * frameW) }}
                />
              </div>
              <div className="flex items-center gap-3 px-6" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-bold text-white/70">A</span>
                <input type="range" min={0.03} max={0.16} step={0.005} value={editing.size} onChange={(e) => setEditing({ ...editing, size: Number(e.target.value) })} className="flex-1 accent-white" aria-label="Boyut" />
                <span className="text-lg font-bold text-white/70">A</span>
              </div>
              <div className="flex justify-center gap-2.5 p-4" onClick={(e) => e.stopPropagation()}>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: c })} aria-label={c} className={cn("size-8 rounded-full border-2 transition-transform", editing.color === c ? "scale-125 border-white" : "border-white/30")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* filters + publish */}
      {!editing && (
        <div className="flex w-full max-w-md flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button key={f.name} onClick={() => setFilter(f.value)} className="flex shrink-0 flex-col items-center gap-1">
                <span className={cn("block size-14 overflow-hidden rounded-xl border-2", filter === f.value ? "border-white" : "border-transparent opacity-80")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="size-full object-cover" style={{ filter: f.value }} />
                </span>
                <span className={cn("text-[10px] font-semibold", filter === f.value ? "text-white" : "text-white/50")}>{f.name}</span>
              </button>
            ))}
          </div>
          <button onClick={publish} disabled={publishing} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black shadow-lg active:scale-[0.98] disabled:opacity-60">
            {publishing ? <Loader2 className="size-4 animate-spin" /> : "Hikayemde paylaş"}
          </button>
        </div>
      )}

      <MusicSheet open={musicOpen} current={music} onClose={() => setMusicOpen(false)} onPick={(m) => { setMusic(m); setMusicOpen(false) }} />
    </motion.div>
  )
}

function TextChip({ layer, frameW }: { layer: Layer; frameW: number }) {
  const boxBg = layer.color === "#ffffff" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)"
  return (
    <span
      className="block rounded-[0.3em] px-[0.4em] py-[0.1em] leading-snug"
      style={{
        color: layer.color,
        fontFamily: FONTS[layer.font],
        fontSize: layer.size * frameW,
        background: layer.boxed ? boxBg : "transparent",
        textShadow: layer.boxed ? "none" : "0 2px 10px rgba(0,0,0,0.6)",
      }}
    >
      {layer.text}
    </span>
  )
}

function RoundButton({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn("flex size-10 items-center justify-center rounded-full backdrop-blur-md transition-colors", active ? "bg-white text-black" : "bg-black/40 text-white")}>
      {children}
    </button>
  )
}

function MusicSheet({ open, current, onClose, onPick }: { open: boolean; current: { url: string; label: string } | null; onClose: () => void; onPick: (m: { url: string; label: string } | null) => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState<number | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    audio.current?.pause()
    setPlaying(null)
  }, [])
  useEffect(() => () => stop(), [stop])

  function search(value: string) {
    setQ(value)
    if (timer.current) clearTimeout(timer.current)
    if (!value.trim()) return setResults([])
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const json = await (await fetch(`/api/deezer-search?q=${encodeURIComponent(value)}`)).json()
        setResults(json.data ?? [])
      } catch {}
      setLoading(false)
    }, 350)
  }

  function preview(t: Track) {
    if (playing === t.id) return stop()
    audio.current?.pause()
    audio.current = new Audio(t.preview)
    audio.current.onended = () => setPlaying(null)
    void audio.current.play()
    setPlaying(t.id)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { stop(); onClose() }} className="fixed inset-0 z-[70] bg-black/50" />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto flex max-h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-neutral-900 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <p className="text-base font-bold text-white">Müzik ekle</p>
              <button onClick={() => { stop(); onClose() }} className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Kapat"><X className="size-4" /></button>
            </div>
            <div className="flex flex-col gap-2 overflow-hidden px-4 pb-4">
              {current && (
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-white">
                  <Music className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{current.label}</span>
                  <button onClick={() => onPick(null)} className="text-xs font-semibold text-red-400">Kaldır</button>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                <input value={q} onChange={(e) => search(e.target.value)} placeholder="Şarkı veya sanatçı ara…" className="h-11 w-full rounded-2xl border border-white/15 bg-white/10 pl-9 pr-9 text-sm text-white outline-none placeholder:text-white/35" />
                {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-white/50" />}
              </div>
              <div className="flex flex-col gap-0.5 overflow-y-auto">
                {!q && <p className="py-6 text-center text-xs text-white/40">Bir şarkı adı yaz 🎵</p>}
                {q && !loading && results.length === 0 && <p className="py-6 text-center text-xs text-white/40">Sonuç yok</p>}
                {results.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2 active:bg-white/10">
                    <button onClick={() => { stop(); onPick({ url: `/api/deezer-preview?id=${t.id}`, label: `${t.title} — ${t.artist.name}` }) }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.album.cover_small} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{t.title}</span>
                        <span className="block truncate text-xs text-white/55">{t.artist.name}</span>
                      </span>
                    </button>
                    <button onClick={() => preview(t)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Dinle">
                      {playing === t.id ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
