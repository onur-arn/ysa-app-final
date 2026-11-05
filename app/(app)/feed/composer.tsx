"use client"

import { useQueryClient } from "@tanstack/react-query"
import { BarChart3, FileText, ImagePlus, Pin, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { FileChipPreview } from "./file-preview"
import { PollFields } from "@/components/poll-view"
import { Button } from "@/components/ui/button"
import { Sheet, Textarea, Toggle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/components/providers/app-context"
import { qk } from "@/lib/data/keys"
import { useI18n } from "@/lib/i18n/context"
import { isIntl } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"
import { compressImage, DOC_ACCEPT, MAX_FILE_BYTES, uploadFile, uploadMedia } from "@/lib/upload"

export function Composer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useApp()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [content, setContent] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [doc, setDoc] = useState<File | null>(null)
  const [withPoll, setWithPoll] = useState(false)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [multiple, setMultiple] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [loading, setLoading] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setContent(""); setImage(null); setDoc(null); setWithPoll(false); setQuestion(""); setOptions(["", ""]); setPinned(false)
  }, [open])

  async function submit() {
    const text = content.trim()
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!text && !withPoll) return toast(t("feed.err.empty"), { error: true })
    if (withPoll && (!question.trim() || opts.length < 2)) return toast(t("poll.err"), { error: true })
    setLoading(true)
    const supabase = createClient()
    try {
      const image_url = image ? await uploadMedia(await compressImage(image), me.id, "posts") : null
      const file_path = doc ? await uploadFile(doc, "feed") : null
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ author_id: me.id, station_id: me.station_id, content: text || question.trim(), image_url, file_path, file_name: doc?.name ?? null, file_size: doc?.size ?? null, pinned: pinned && isIntl(me) })
        .select("id")
        .single()
      if (error) throw error
      if (withPoll) {
        const { data: poll, error: pe } = await supabase.from("polls").insert({ post_id: post.id, question: question.trim(), multiple }).select("id").single()
        if (pe) throw pe
        await supabase.from("poll_options").insert(opts.map((label, position) => ({ poll_id: poll.id, label, position })))
      }
      void qc.invalidateQueries({ queryKey: qk.feed })
      toast(t("feed.published"))
      onClose()
    } catch {
      toast(t("common.error"), { error: true })
    }
    setLoading(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("feed.newPost")} footer={<Button className="w-full" size="lg" onClick={submit} loading={loading}>{t("feed.publish")}</Button>}>
      <div className="flex flex-col gap-4">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("feed.postPlaceholder")} className="min-h-32" />
        {image && (
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(image)} alt="" className="max-h-64 w-full object-cover" />
            <button onClick={() => setImage(null)} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white" aria-label="remove"><X className="size-4" /></button>
          </div>
        )}
        {doc && <FileChipPreview file={doc} onRemove={() => setDoc(null)} />}
        {withPoll && (
          <div className="rounded-2xl border border-border p-3">
            <PollFields question={question} setQuestion={setQuestion} options={options} setOptions={setOptions} multiple={multiple} setMultiple={setMultiple} />
          </div>
        )}
        {isIntl(me) && <Toggle checked={pinned} onChange={setPinned} label={<span className="flex items-center gap-2"><Pin className="size-4 text-primary" /> {t("feed.pinTop")}</span>} />}
        <div className="flex flex-wrap gap-2">
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { setImage(e.target.files?.[0] ?? null); e.target.value = "" }} />
          <input
            ref={docRef}
            type="file"
            accept={DOC_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f && f.size > MAX_FILE_BYTES) return toast(t("files.tooBig"), { error: true })
              setDoc(f ?? null)
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => imgRef.current?.click()}><ImagePlus className="size-4" /> {t("feed.photo")}</Button>
          <Button variant="secondary" size="sm" onClick={() => docRef.current?.click()}><FileText className="size-4" /> PDF</Button>
          <Button variant={withPoll ? "primary" : "secondary"} size="sm" onClick={() => setWithPoll((v) => !v)}><BarChart3 className="size-4" /> {t("poll.poll")}</Button>
        </div>
      </div>
    </Sheet>
  )
}
