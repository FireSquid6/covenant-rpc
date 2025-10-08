"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useServerChannels } from "@/hooks/useServers";

export default function ServerSettings() {
  const params = useParams();
  const serverId = params.serverId!.toString();
  const { data, error, loading } = useServerChannels(serverId);
  
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    
    setIsCreating(true);
    // TODO: Implement actual channel creation
    console.log("Creating channel:", newChannelName);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setNewChannelName("");
    setIsCreating(false);
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    if (!confirm(`Are you sure you want to delete #${channelName}?`)) return;
    
    // TODO: Implement actual channel deletion
    console.log("Deleting channel:", channelId);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-2xl">
          <div className="h-8 w-48 bg-base-content/30 rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 w-32 bg-base-content/30 rounded animate-pulse"></div>
            <div className="h-10 w-full bg-base-content/30 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-base-content/30 rounded animate-pulse"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-base-content/30 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-base-content mb-6">Server Settings</h1>
          <div className="text-center py-8">
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
      </div>
    );
  }

  const { server, channels } = data;

  return (
    <div className="flex-1 p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-base-content mb-6">
          {server.name} Settings
        </h1>

        <div className="space-y-8">
          {/* Create Channel Section */}
          <div>
            <h2 className="text-lg font-semibold text-base-content mb-4">
              Create Channel
            </h2>
            <form onSubmit={handleCreateChannel} className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Channel name"
                  className="input input-bordered w-full"
                  disabled={isCreating}
                />
              </div>
              <button
                type="submit"
                disabled={!newChannelName.trim() || isCreating}
                className="btn btn-primary"
              >
                {isCreating ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Create"
                )}
              </button>
            </form>
          </div>

          {/* Manage Channels Section */}
          <div>
            <h2 className="text-lg font-semibold text-base-content mb-4">
              Manage Channels
            </h2>
            <div className="space-y-2">
              {channels.length === 0 ? (
                <div className="text-center py-8 text-base-content/60">
                  No channels yet. Create one above!
                </div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base-content/60">#</span>
                      <span className="font-medium text-base-content">
                        {channel.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteChannel(channel.id, channel.name)}
                      className="btn btn-error btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}