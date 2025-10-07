"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useServerChannels } from "@/hooks/useServers";

interface ChannelListProps {
  serverId: string
}

export default function ChannelList({ serverId }: ChannelListProps) {
  const pathname = usePathname();
  const split = pathname.split("/");
  const selectedChannelId = split[3] ?? "none";
  const { data, error, loading } = useServerChannels(serverId);

  if (loading) {
    // TODO - loading state
    return (
      <></>
    )
  }
  if (error) {
    // TODO - better error management
    console.error(error);
    return (
      <></>
    )
  }

  const { server, channels } = data;

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      <div className="h-16 border-b border-gray-700 flex items-center px-4">
        <h2 className="text-white font-semibold text-lg truncate">{server.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Text Channels
            </h3>
            <button className="text-gray-400 hover:text-white text-lg">+</button>
          </div>

          <div className="space-y-1">
            {channels.map(channel => (
              <Link
                key={channel.id}
                href={`/servers/${serverId}`}
                className={`
                  w-full flex items-center px-2 py-1.5 rounded text-left
                  transition-colors duration-150
                  ${selectedChannelId === channel.id
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <span className="mr-2 text-gray-400">#</span>
                <span className="text-sm font-medium">{channel.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="h-16 bg-gray-900 border-t border-gray-700 flex items-center px-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">User</p>
            <p className="text-gray-400 text-xs">Online</p>
          </div>
          <div className="flex space-x-1">
            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors">
              🎤
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors">
              🎧
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors">
              ⚙️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
