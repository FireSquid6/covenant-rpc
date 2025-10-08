"use client"
import { ServerList } from "@/components/ServerList"
import { useParams } from "next/navigation"


export default function ServersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const serverId = params.serverId;
  return (
    <main className="flex flex-row h-screen">
      <ServerList 
        selectedServerId={serverId?.toString()}
        />
      {children}
    </main>
  )

}
