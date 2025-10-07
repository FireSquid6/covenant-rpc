import { ServerList } from "@/components/ServerList"


export default function ServersLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-row h-screen">
      <ServerList />
      {children}
    </main>
  )

}
