"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useServerChannels } from "@/hooks/useServers";

interface UserPanelProps {
  isLoading?: boolean;
}

function UserPanel({ isLoading }: UserPanelProps) {
  return (
    <div className="h-16 bg-base-200 border-t border-base-content/20 flex items-center px-2">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          {isLoading ? (
            <div className="w-8 h-8 bg-base-content/30 rounded-full animate-pulse"></div>
          ) : (
            <span className="text-primary-content text-sm font-semibold">U</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <>
              <div className="h-4 w-16 bg-base-content/30 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-12 bg-base-content/30 rounded animate-pulse"></div>
            </>
          ) : (
            <>
              <p className="text-base-content text-sm font-medium truncate">User</p>
              <p className="text-base-content/60 text-xs">Online</p>
            </>
          )}
        </div>
        <div className="flex space-x-1">
          <button className="w-8 h-8 flex items-center justify-center text-base-content/60 hover:text-base-content rounded hover:bg-base-content/10 transition-colors">
            🎤
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-base-content/60 hover:text-base-content rounded hover:bg-base-content/10 transition-colors">
            🎧
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-base-content/60 hover:text-base-content rounded hover:bg-base-content/10 transition-colors">
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChannelHeaderProps {
  title?: string;
  isLoading?: boolean;
  isError?: boolean;
}

function ChannelHeader({ title, isLoading, isError }: ChannelHeaderProps) {
  return (
    <div className="h-16 border-b border-base-content/20 flex items-center px-4">
      {isLoading ? (
        <div className="h-6 w-32 bg-base-content/30 rounded animate-pulse"></div>
      ) : isError ? (
        <h2 className="text-error font-semibold text-lg">Error</h2>
      ) : (
        <h2 className="text-base-content font-semibold text-lg truncate">{title}</h2>
      )}
    </div>
  );
}


export default function ChannelList() {
  const pathname = usePathname();
  const split = pathname.split("/");
  const serverId = split[2] ?? "none";
  const selectedChannelId = split[3] ?? "none";
  const { data, error, loading } = useServerChannels(serverId);

  if (loading) {
    return (
      <div className="w-60 bg-base-300 flex flex-col">
        <ChannelHeader isLoading />
        
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">
                Text Channels
              </h3>
              <button className="text-base-content/60 hover:text-base-content text-lg">+</button>
            </div>
            
            <div className="space-y-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-full flex items-center px-2 py-1.5">
                  <span className="mr-2 text-base-content/60">#</span>
                  <div className={`h-4 bg-base-content/30 rounded animate-pulse ${i === 0 ? 'w-20' : i === 1 ? 'w-16' : 'w-24'}`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <UserPanel isLoading />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="w-60 bg-base-300 flex flex-col">
        <ChannelHeader isError />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-error text-4xl mb-2">⚠️</div>
            <p className="text-base-content/70 text-sm mb-4">Failed to load server data</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-error btn-sm"
            >
              Retry
            </button>
          </div>
        </div>

        <UserPanel />
      </div>
    )
  }

  const { server, channels } = data;

  return (
    <div className="w-60 bg-base-300 flex flex-col">
      <ChannelHeader title={server.name} />

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-base-content/60 text-xs font-semibold uppercase tracking-wider">
              Text Channels
            </h3>
            <button className="text-base-content/60 hover:text-base-content text-lg">+</button>
          </div>

          <div className="space-y-1">
            {channels.map(channel => (
              <Link
                key={channel.id}
                href={`/servers/${serverId}/${channel.id}`}
                className={`
                  w-full flex items-center px-2 py-1.5 rounded text-left
                  transition-colors duration-150
                  ${selectedChannelId === channel.id
                    ? 'bg-primary text-primary-content'
                    : 'text-base-content/70 hover:bg-base-content/10 hover:text-base-content'
                  }
                `}
              >
                <span className="mr-2 text-base-content/60">#</span>
                <span className="text-sm font-medium">{channel.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <UserPanel />
    </div>
  );
}
