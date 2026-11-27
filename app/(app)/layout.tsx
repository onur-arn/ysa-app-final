import type { ReactNode } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { AppProvider } from "@/components/providers/app-context"
import { ImageViewerProvider } from "@/components/image-viewer"
import { PdfViewerProvider } from "@/components/pdf-viewer"
import { ProfileProvider } from "@/components/profile/profile-link"
import { QueryProvider } from "@/components/providers/query-provider"
import { RealtimeHub } from "@/lib/realtime/hub"
import { PaletteScope } from "@/lib/theme/context"
import { requireProfile } from "@/lib/auth"
import { MEMBER_COLUMNS } from "@/lib/data/fetchers"
import { createClient } from "@/lib/supabase/server"
import type { Member, Station } from "@/lib/types"

// The layout is rendered once per session; switching tabs never refetches it —
// pages read from the realtime cache instead.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await requireProfile()
  const supabase = await createClient()
  const [stations, members] = await Promise.all([
    supabase.from("stations").select("*").order("position"),
    supabase.from("profiles").select(MEMBER_COLUMNS).eq("status", "active").order("first_name"),
  ])
  return (
    <QueryProvider userId={me.id}>
      <AppProvider me={me} stations={(stations.data ?? []) as Station[]} initialMembers={(members.data ?? []) as Member[]}>
        <RealtimeHub>
          <PaletteScope />
          <ImageViewerProvider>
            <PdfViewerProvider>
              <ProfileProvider>
                <AppShell>{children}</AppShell>
              </ProfileProvider>
            </PdfViewerProvider>
          </ImageViewerProvider>
        </RealtimeHub>
      </AppProvider>
    </QueryProvider>
  )
}
