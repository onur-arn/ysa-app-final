"use client"

import { Check } from "lucide-react"
import { useState } from "react"
import { AvatarStack } from "@/components/avatar"
import { useApp } from "@/components/providers/app-context"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import type { Poll } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Poll used both on the feed and inside chats. Votes sync live through the hub. */
export function PollView({ poll, onChanged, inverted }: { poll: Poll; onChanged: (next: Poll) => void; inverted?: boolean }) {
  const { me } = useApp()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const mine = new Set(poll.poll_votes.filter((v) => v.user_id === me.id).map((v) => v.option_id))
  const voters = new Set(poll.poll_votes.map((v) => v.user_id)).size
  const options = [...poll.poll_options].sort((a, b) => a.position - b.position)

  async function vote(optionId: string) {
    if (busy) return
    setBusy(true)
    const supabase = createClient()
    // optimistic
    let votes = poll.poll_votes
    if (mine.has(optionId)) votes = votes.filter((v) => !(v.user_id === me.id && v.option_id === optionId))
    else votes = [...(poll.multiple ? votes : votes.filter((v) => v.user_id !== me.id)), { option_id: optionId, user_id: me.id }]
    onChanged({ ...poll, poll_votes: votes })
    if (mine.has(optionId)) await supabase.from("poll_votes").delete().eq("option_id", optionId).eq("user_id", me.id)
    else {
      if (!poll.multiple && mine.size) await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("user_id", me.id)
      await supabase.from("poll_votes").insert({ poll_id: poll.id, option_id: optionId, user_id: me.id })
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold">{poll.question}</p>
      {options.map((o) => {
        const votes = poll.poll_votes.filter((v) => v.option_id === o.id)
        const pct = voters ? Math.round((votes.length / voters) * 100) : 0
        const selected = mine.has(o.id)
        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            className={cn(
              "relative overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              inverted ? "border-primary-foreground/30" : selected ? "border-primary" : "border-border hover:border-primary/50",
            )}
          >
            <span className={cn("absolute inset-y-0 left-0 transition-all", inverted ? "bg-primary-foreground/20" : "bg-primary/12")} style={{ width: `${pct}%` }} />
            <span className="relative flex items-center gap-2">
              <span className={cn("flex size-4 shrink-0 items-center justify-center border", poll.multiple ? "rounded" : "rounded-full", selected ? (inverted ? "border-primary-foreground bg-primary-foreground text-primary" : "border-primary bg-primary text-primary-foreground") : "border-current opacity-50")}>
                {selected && <Check className="size-3" />}
              </span>
              <span className="flex-1 font-medium">{o.label}</span>
              {votes.length > 0 && <AvatarStack ids={votes.map((v) => v.user_id)} max={3} size={18} />}
              <span className="text-xs font-semibold opacity-75">{pct}%</span>
            </span>
          </button>
        )
      })}
      <p className="text-[11px] opacity-70">{t("poll.voters", { n: voters })}{poll.multiple ? ` · ${t("poll.multiple")}` : ""}</p>
    </div>
  )
}

/** Shared poll composer fields */
export function PollFields({ question, setQuestion, options, setOptions, multiple, setMultiple }: {
  question: string; setQuestion: (v: string) => void; options: string[]; setOptions: (v: string[]) => void; multiple: boolean; setMultiple: (v: boolean) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("poll.question")} className="h-12 rounded-2xl border border-border bg-background px-4 text-base outline-none focus:border-primary" />
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t("poll.option", { n: i + 1 })} className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" />
          {options.length > 2 && <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="px-2 text-muted-foreground" aria-label="remove">✕</button>}
        </div>
      ))}
      {options.length < 8 && <button type="button" onClick={() => setOptions([...options, ""])} className="self-start px-1 text-sm font-semibold text-primary">+ {t("poll.addOption")}</button>}
      <label className="flex items-center gap-2 px-1 text-sm text-foreground">
        <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-4 accent-[var(--primary)]" /> {t("poll.multiple")}
      </label>
    </div>
  )
}
