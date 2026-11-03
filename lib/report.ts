import { toast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/client"
import type { Report } from "@/lib/types"

/**
 * File a report on a piece of content. A message report also unlocks that one
 * conversation for the moderator (read-only, logged). The reason is optional.
 */
export async function reportContent(
  kind: Report["kind"],
  targetId: string,
  conversationId: string | null,
  reason: string,
) {
  const { error } = await createClient().rpc("report_content", {
    p_kind: kind,
    p_target: targetId,
    p_conversation: conversationId,
    p_reason: reason.trim(),
  })
  if (error) {
    toast(error.message, { error: true })
    return false
  }
  return true
}
