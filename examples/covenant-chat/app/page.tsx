"use client";

import { useState } from "react";
import ServerList from "@/components/ServerList";
import ChannelList from "@/components/ChannelList";
import ChatArea from "@/components/ChatArea";
import { dummyServers, dummyChannels, dummyMessages, dummyUsers } from "@/lib/dummy-data";

export default function Home() {
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>("server-1");
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>("channel-1");

  const selectedServer = dummyServers.find(server => server.id === selectedServerId);
  const selectedChannel = dummyChannels.find(channel => channel.id === selectedChannelId);

  const handleServerSelect = (serverId: string) => {
    setSelectedServerId(serverId);
    const firstChannelInServer = dummyChannels.find(channel => channel.serverId === serverId);
    setSelectedChannelId(firstChannelInServer?.id);
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  return (
    <div className="flex h-screen bg-gray-800">
      <ServerList 
        selectedServerId={selectedServerId}
        onServerSelect={handleServerSelect}
      />
      
      <ChannelList
        server={selectedServer}
        channels={dummyChannels}
        selectedChannelId={selectedChannelId}
        onChannelSelect={handleChannelSelect}
      />
      
      <ChatArea
        channel={selectedChannel}
        messages={dummyMessages}
        users={dummyUsers}
      />
    </div>
  );
}
