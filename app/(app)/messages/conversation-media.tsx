"use client"

import { ImageIcon, Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FileChip } from "@/components/file-chip"
import { useImageViewer } from "@/components/image-viewer"
import { EmptyState, Segmented } from "@/components/ui/misc"
import { Sheet } from "@/components/ui/sheet"
import type { MediaTab } from "@/lib/data/fetchers"
import { useConversationMedia, useMemberMap } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { LINK_RE, openLink } from "@/lib/open-link"
import type { Message } from "@/lib/types"

/** Small strip of the latest photos, shown in the conversation info. */
export function MediaStrip({ convId, onOpen }: { convId: string; onOpen: () => void }) {
  const { t } = useI18n()
  const { data = [] } = useConversationMedia(convId, "media", true)
  return (
    <button onClick={onOpen} className="flex w-full flex-col gap-2 rounded-2xl bg-secondary/60 p-3 text-left active:bg-secondary">
      <span className="flex items-center justify-between text-sm font-semibold text-foreground">
        {t("messages.mediaTitle")}
        <span className="text-xs font-medium text-muted-foreground">{data.length > 0 ? `${data.length >= 300 ? "300+" : data.length} ›` : "›"}</span>
      </span>
      {data.length > 0 && (
        <span className="flex gap-1.5 overflow-hidden">
          {data.slice(0, 5).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.attachment_url!} alt="" className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" />
          ))}
        </span>
      )}
    </button>
  )
}

/** Medya / Belgeler / Bağlantılar of one conversation, newest first. */
export function MediaSheet({ open, convId, onClose, onJump }: { open: boolean; convId: string; onClose: () => void; onJump: (m: Message) => void }) {
  const { t, fmtDate } = useI18n()
  const [tab, setTab] = useState<MediaTab>("media")
  const viewer = useImageViewer()
  const router = useRouter()
  const member = useMemberMap()
  const { data = [], isPending } = useConversationMedia(convId, tab, open)

  return (
    <Sheet open={open} onClose={onClose} title={t("messages.mediaTitle")}>
      <Segmented
        layoutId="media-tab"
        className="mb-3"
        value={tab}
        onChange={setTab}
        options={[{ id: "media", label: t("messages.tabMedia") }, { id: "docs", label: t("messages.tabDocs") }, { id: "links", label: t("messages.tabLinks") }]}
      />
      {isPending ? (
        <div className="grid grid-cols-3 gap-1">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-secondary" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={tab === "links" ? Link2 : ImageIcon} title={t(`messages.empty.${tab}`)} />
      ) : tab === "media" ? (
        <div className="grid grid-cols-3 gap-1">
          {data.map((m) => (
            <button key={m.id} onClick={() => viewer.open(m.attachment_url!)} className="aspect-square overflow-hidden rounded-lg bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.attachment_url!} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : tab === "docs" ? (
        <div className="flex flex-col gap-2">
          {data.map((m) => (
            <div key={m.id}>
              <FileChip path={m.attachment_url!} name={m.attachment_name ?? "dosya"} size={m.attachment_size} />
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">{member(m.sender_id)?.full_name} · {fmtDate(m.created_at, { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {data.flatMap((m) => (m.content?.match(LINK_RE) ?? []).map((url, i) => (
            <div key={`${m.id}-${i}`} className="flex items-center gap-3 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><Link2 className="size-5" /></span>
              <button onClick={() => void openLink(url, (path) => { onClose(); router.push(path) })} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-primary">{url.replace(/^https?:\/\//, "")}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{member(m.sender_id)?.full_name} · {fmtDate(m.created_at, { day: "numeric", month: "short" })}</span>
              </button>
              <button onClick={() => onJump(m)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{t("messages.goToMessage")}</button>
            </div>
          )))}
        </div>
      )}
    </Sheet>
  )
}
