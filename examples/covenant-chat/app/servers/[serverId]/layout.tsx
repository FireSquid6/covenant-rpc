"use client";
import ChannelList from "@/components/ChannelList";
import { useParams } from "next/navigation";

export default function ServerView({ children }: { children: React.ReactNode }) {
  const params = useParams();

  const channelId = params.channelId;
  const serverId = params.serverId!.toString();


  return (
    <>
      <ChannelList 
        channelId={channelId?.toString()}
        serverId={serverId}
      />
      <div>
        {children}
      </div>
    </>
  )

}
