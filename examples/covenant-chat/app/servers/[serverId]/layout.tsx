import ChannelList from "@/components/ChannelList";

export default function ServerView({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChannelList />
      <div>
        {children}
      </div>
    </>
  )

}
