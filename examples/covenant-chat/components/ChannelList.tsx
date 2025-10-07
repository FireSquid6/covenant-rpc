"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useServerChannels } from "@/hooks/useServers";


export default function ChannelList() {
  const pathname = usePathname();
  const split = pathname.split("/");
  const serverId = split[2] ?? "none";
  const selectedChannelId = split[3] ?? "none";
  const { data, error, loading } = useServerChannels(serverId);

  if (loading) {
    return (
      <div className="w-60 bg-gray-800 flex flex-col">
        <div className="h-16 border-b border-gray-700 flex items-center px-4">
          <div className="h-6 w-32 bg-gray-600 rounded animate-pulse"></div>
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
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-full flex items-center px-2 py-1.5">
                  <span className="mr-2 text-gray-400">#</span>
                  <div className={`h-4 bg-gray-600 rounded animate-pulse ${i === 0 ? 'w-20' : i === 1 ? 'w-16' : 'w-24'}`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-16 bg-gray-900 border-t border-gray-700 flex items-center px-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-600 rounded-full animate-pulse"></div>
            <div className="flex-1 min-w-0">
              <div className="h-4 w-16 bg-gray-600 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-12 bg-gray-600 rounded animate-pulse"></div>
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
    )
  }
  
  if (error) {
    return (
      <div className="w-60 bg-gray-800 flex flex-col">
        <div className="h-16 border-b border-gray-700 flex items-center px-4">
          <h2 className="text-red-400 font-semibold text-lg">Error</h2>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 text-4xl mb-2">⚠️</div>
            <p className="text-gray-300 text-sm mb-4">Failed to load server data</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              Retry
            </button>
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
