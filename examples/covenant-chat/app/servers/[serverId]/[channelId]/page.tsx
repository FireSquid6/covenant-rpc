import ChannelChat from "@/components/ChannelChat";
import { db } from "@/lib/db";
import { channelTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function ChannelPage({ params }: { params: Promise<{ channelId: string, serverId: string }> }) {
  const { channelId, serverId } = await params;

  // Fetch channel data server-side for initial render
  const channels = await db
    .select()
    .from(channelTable)
    .where(eq(channelTable.id, channelId))
    .limit(1);

  const channel = channels.length > 0 ? channels[0] : null;

  return <ChannelChat channelId={channelId} channel={channel} />;
}
