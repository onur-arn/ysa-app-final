import { ChatThread } from "./chat-thread"

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ChatThread id={id} />
}
