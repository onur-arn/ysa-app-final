"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { MemberAvatar } from "@/components/avatar"
import { Sheet } from "@/components/ui/sheet"
import { searchMessages } from "@/lib/data/fetchers"
import { useMemberMap } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import type { Message } from "@/lib/types"

/** Search inside one conversation (WhatsApp "Ara"): tap a result to jump to it. */
export function MessageSearch({ open, convId, onClose, onPick }: { open: boolean; convId: string; onClose: () => void; onPick: (m: Message) => void }) {
  const { t, fmtDate } = useI18n()
  const member = useMemberMap()
  const [q, setQ] = useState("")
  const [term, setTerm] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setTerm(q.trim()), 250)
    return () => clearTimeout(timer)
  }, [q])
  useEffect(() => { if (!open) setQ("") }, [open])

  const { data = [], isFetching } = useQuery({
    queryKey: ["search", convId, term],
    queryFn: () => searchMessages(convId, term),
    enabled: open && term.length >= 2,
  })

  return (
    <Sheet open={open} onClose={onClose} title={t("messages.searchIn")}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.searchPlaceholder")} className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-10 text-sm outline-none focus:border-primary" />
        {isFetching && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {term.length >= 2 && !isFetching && data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("messages.noResults")}</p>}
      <div className="flex flex-col">
        {data.map((m) => (
          <button key={m.id} onClick={() => onPick(m)} className="flex items-start gap-3 rounded-xl px-1 py-2 text-left active:bg-secondary">
            <MemberAvatar id={m.sender_id} size={34} showOnline={false} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs">
                <b className="truncate text-foreground">{member(m.sender_id)?.full_name ?? t("common.formerMember")}</b>
                <span className="ml-auto shrink-0 text-muted-foreground">{fmtDate(m.created_at, { day: "numeric", month: "short", year: "2-digit" })}</span>
              </span>
              <Highlight text={m.content ?? ""} term={term} />
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Highlight({ text, term }: { text: string; term: string }) {
  const i = text.toLocaleLowerCase("tr").indexOf(term.toLocaleLowerCase("tr"))
  if (i < 0) return <span className="line-clamp-2 text-sm text-muted-foreground">{text}</span>
  const start = Math.max(0, i - 40)
  return (
    <span className="line-clamp-2 text-sm text-muted-foreground">
      {start > 0 && "…"}{text.slice(start, i)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </span>
  )
}
