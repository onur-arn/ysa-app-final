"use client"

import { BarChart3, CornerUpLeft, FileText, ImageIcon, Loader2, Mic, Plus, Send, Smile, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { VoiceRecorderBar, useVoiceRecorder } from "@/components/audio-message"
import { MemberAvatar } from "@/components/avatar"
import { GifPicker } from "@/components/gif-picker"
import { PollFields } from "@/components/poll-view"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { useMemberMap } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { isDeleted } from "@/lib/members"
import { useHub } from "@/lib/realtime/hub"
import type { Member, Message } from "@/lib/types"
import { DOC_ACCEPT, MAX_FILE_BYTES } from "@/lib/upload"
import { cn } from "@/lib/utils"

export type Outgoing =
  | { kind: "text"; content: string; mentions: string[] }
  | { kind: "image" | "file"; file: File; content?: string }
  | { kind: "audio"; blob: Blob }
  | { kind: "gif"; url: string }
  | { kind: "poll"; question: string; options: string[]; multiple: boolean }

export function ChatComposer({
  convId, memberIds, isGroup, replyTo, onCancelReply, onSend,
}: {
  convId: string
  memberIds: string[]
  isGroup: boolean
  replyTo: Message | null
  onCancelReply: () => void
  onSend: (o: Outgoing) => Promise<void>
}) {
  const { me, station } = useApp()
  const { t } = useI18n()
  const member = useMemberMap()
  const { sendTyping } = useHub()
  const [text, setText] = useState("")
  const [mentions, setMentions] = useState<Member[]>([])
  const [query, setQuery] = useState<string | null>(null)
  const [attach, setAttach] = useState(false)
  const [gif, setGif] = useState(false)
  const [poll, setPoll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pq, setPq] = useState("")
  const [po, setPo] = useState(["", ""])
  const [pm, setPm] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const voice = useVoiceRecorder()

  // "@" autocomplete over the conversation's members (groups only)
  const candidates = useMemo(() => {
    if (query === null || !isGroup) return []
    const q = query.toLocaleLowerCase("tr")
    return memberIds.filter((id) => id !== me.id).map((id) => member(id)).filter((m): m is Member => !!m && !isDeleted(m) && m.full_name.toLocaleLowerCase("tr").includes(q)).slice(0, 6)
  }, [query, memberIds, member, me.id, isGroup])

  function onChange(value: string) {
    setText(value)
    sendTyping(convId)
    const caret = ref.current?.selectionStart ?? value.length
    const match = /(^|\s)@([\p{L}\p{M} ]{0,24})$/u.exec(value.slice(0, caret))
    setQuery(match ? match[2] : null)
  }

  function pick(m: Member) {
    const caret = ref.current?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@([\p{L}\p{M} ]{0,24})$/u, `@${m.full_name} `)
    setText(before + text.slice(caret))
    setMentions((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]))
    setQuery(null)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(before.length, before.length)
    })
  }

  async function run(o: Outgoing) {
    setBusy(true)
    try {
      await onSend(o)
    } catch {
      toast(t("common.error"), { error: true })
    }
    setBusy(false)
  }

  async function submit() {
    const content = text.trim()
    if (!content) return
    const ids = mentions.filter((m) => content.includes(`@${m.full_name}`)).map((m) => m.id)
    setText("")
    setMentions([])
    setQuery(null)
    ref.current?.focus()   // keep the keyboard open for the next message
    void run({ kind: "text", content, mentions: ids })
  }

  function file(kind: "image" | "file", f: File | undefined) {
    setAttach(false)
    if (!f) return
    if (f.size > MAX_FILE_BYTES) return toast(t("files.tooBig"), { error: true })
    void run({ kind, file: f })
  }

  async function stopVoice() {
    const res = await voice.stop()
    if (res) void run({ kind: "audio", blob: res.blob })
  }

  async function sendPoll() {
    const options = po.map((o) => o.trim()).filter(Boolean)
    if (!pq.trim() || options.length < 2) return toast(t("poll.err"), { error: true })
    setPoll(false)
    await run({ kind: "poll", question: pq.trim(), options, multiple: pm })
    setPq("")
    setPo(["", ""])
  }

  return (
    <div className="relative border-t border-border/60 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <AnimatePresence>
        {candidates.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-2xl">
            {candidates.map((m) => (
              <button key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-secondary">
                <MemberAvatar id={m.id} size={30} />
                <span className="flex-1 truncate text-sm font-semibold" style={{ color: `hsl(${station(m.station_id)?.color})` }}>{m.full_name}</span>
                <span className="text-[11px] text-muted-foreground">{station(m.station_id)?.short}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-xs">
          <CornerUpLeft className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate"><b>{member(replyTo.sender_id)?.full_name}</b> · {replyTo.content ?? replyTo.attachment_name ?? t(`messages.kind.${replyTo.kind}`)}</span>
          <button onClick={onCancelReply} aria-label="cancel"><X className="size-3.5" /></button>
        </div>
      )}

      {voice.recording ? (
        <VoiceRecorderBar recording seconds={voice.seconds} onStop={stopVoice} onCancel={voice.cancel} />
      ) : (
        <div className="flex items-end gap-2">
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { file("image", e.target.files?.[0]); e.target.value = "" }} />
          <input ref={docRef} type="file" accept={DOC_ACCEPT} hidden onChange={(e) => { file("file", e.target.files?.[0]); e.target.value = "" }} />
          <div className="relative">
            <button onClick={() => setAttach((v) => !v)} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-transform hover:bg-secondary", attach && "rotate-45")} aria-label={t("messages.attach")}>
              <Plus className="size-6" />
            </button>
            <AnimatePresence>
              {attach && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAttach(false)} />
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-14 left-0 z-50 w-56 rounded-2xl border border-border bg-popover p-1.5 shadow-2xl">
                    <AttachItem icon={ImageIcon} tone="bg-sky-500" onClick={() => photoRef.current?.click()}>{t("messages.photo")}</AttachItem>
                    <AttachItem icon={FileText} tone="bg-red-500" onClick={() => docRef.current?.click()}>{t("messages.document")}</AttachItem>
                    <AttachItem icon={Smile} tone="bg-violet-500" onClick={() => { setAttach(false); setGif(true) }}>GIF</AttachItem>
                    <AttachItem icon={BarChart3} tone="bg-amber-500" onClick={() => { setAttach(false); setPoll(true) }}>{t("poll.poll")}</AttachItem>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (candidates.length) pick(candidates[0])
                else void submit()
              }
            }}
            rows={1}
            placeholder={isGroup ? t("messages.typeMention") : t("messages.typeMessage")}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:border-primary"
          />
          {text.trim() ? (
            <button onClick={submit} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={t("common.send")}>
              <Send className="size-5" />
            </button>
          ) : (
            <button onClick={voice.start} disabled={busy} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-label={t("messages.voice")}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
            </button>
          )}
        </div>
      )}

      <GifPicker open={gif} onClose={() => setGif(false)} onSelect={(url) => { setGif(false); void run({ kind: "gif", url }) }} />
      <Sheet open={poll} onClose={() => setPoll(false)} title={t("poll.new")} footer={<Button className="w-full" size="lg" onClick={sendPoll}>{t("common.send")}</Button>}>
        <PollFields question={pq} setQuestion={setPq} options={po} setOptions={setPo} multiple={pm} setMultiple={setPm} />
      </Sheet>
    </div>
  )
}

function AttachItem({ icon: Icon, tone, onClick, children }: { icon: React.ComponentType<{ className?: string }>; tone: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-foreground hover:bg-secondary">
      <span className={cn("flex size-8 items-center justify-center rounded-full text-white", tone)}><Icon className="size-4" /></span>
      {children}
    </button>
  )
}

