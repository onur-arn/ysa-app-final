"use client"

import { Cake, Newspaper, PenSquare } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ProfileSheet } from "@/components/profile/profile-sheet"
import { Button } from "@/components/ui/button"
import { Card, EmptyState } from "@/components/ui/misc"
import { useApp } from "@/components/providers/app-context"
import { useFeed, useMembers } from "@/lib/data/hooks"
import { useI18n } from "@/lib/i18n/context"
import { isGuest } from "@/lib/permissions"
import { Composer } from "./composer"
import { PostCard } from "./post-card"
import { StoriesBar } from "./stories-bar"

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <Card key={i} className="flex flex-col gap-3">
          <div className="flex items-center gap-3"><div className="size-10 animate-pulse rounded-full bg-secondary" /><div className="h-3 w-1/3 animate-pulse rounded bg-secondary" /></div>
          <div className="h-3 w-full animate-pulse rounded bg-secondary" /><div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
        </Card>
      ))}
    </div>
  )
}

export function FeedClient() {
  const { t } = useI18n()
  const { me } = useApp()
  const params = useSearchParams()
  const { data: posts, isPending } = useFeed()
  const { data: members = [] } = useMembers()
  const [composer, setComposer] = useState(false)
  const [profile, setProfile] = useState<string | null>(null)
  const focus = params.get("post")
  const guest = isGuest(me) // Misafir: read-only

  useEffect(() => {
    if (focus && posts) document.getElementById(`post-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focus, posts])

  const birthdays = useMemo(() => {
    const d = new Date()
    const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return members.filter((m) => m.birthday?.slice(5) === md)
  }, [members])

  return (
    <div className="flex flex-col">
      <StoriesBar />
      <div className="flex flex-col gap-4 px-4 pt-1">
        {birthdays.length > 0 && (
          <Card className="flex items-center gap-3 border-amber-500/30 bg-amber-500/8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xl">🎂</span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">{t("feed.birthdayToday")}</p>
              <p className="truncate text-muted-foreground">{birthdays.map((m) => m.full_name).join(", ")}</p>
            </div>
            <Cake className="ml-auto size-5 shrink-0 text-amber-500" />
          </Card>
        )}
        <button disabled={guest} onClick={() => setComposer(true)} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
          <PenSquare className={guest ? "size-4" : "size-4 text-primary"} /> {t("feed.composerPlaceholder", { name: me.first_name })}
        </button>
        {isPending && !posts ? (
          <FeedSkeleton />
        ) : !posts?.length ? (
          <EmptyState icon={Newspaper} title={t("feed.empty")} text={t("feed.emptyText")} action={guest ? undefined : <Button onClick={() => setComposer(true)}>{t("feed.publish")}</Button>} />
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} highlight={p.id === focus} onOpenProfile={setProfile} />)
        )}
      </div>
      {!guest && <Composer open={composer} onClose={() => setComposer(false)} />}
      <ProfileSheet memberId={profile} onClose={() => setProfile(null)} />
    </div>
  )
}
