"use client";

import type { Channel } from "@/lib/db/schema";

interface Server {
  id: string;
  name: string;
}

interface ChannelListProps {
  server?: Server;
  channels: Channel[];
  selectedChannelId?: string;
  onChannelSelect: (channelId: string) => void;
}

export default function ChannelList({ server, channels, selectedChannelId, onChannelSelect }: ChannelListProps) {
  if (!server) {
    return (
      <div className="w-60 bg-gray-800 flex items-center justify-center">
        <p className="text-gray-400">Select a server</p>
      </div>
    );
  }

  const serverChannels = channels.filter(channel => channel.serverId === server.id);

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
            {serverChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel.id)}
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
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 py-1">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Voice Channels
            </h3>
            <button className="text-gray-400 hover:text-white text-lg">+</button>
          </div>
          
          <div className="space-y-1">
            <button className="w-full flex items-center px-2 py-1.5 rounded text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-150">
              <span className="mr-2 text-gray-400">🔊</span>
              <span className="text-sm font-medium">General</span>
            </button>
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