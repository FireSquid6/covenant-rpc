

// TODO - make this a client component probably
export default async function ChannelPage({ params }: { params: Promise<{ channelId: string, serverId: string }> }) {
  const { channelId, serverId } = await params;

  return (
    <div>
      <p>Channel page for {channelId} on {serverId}. I haven't written a channel page yet</p>
    </div>
  )
}
