"use client";

import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { authClient } from "@/client/auth";
import ChatArea from "./ChatArea";
import type { Channel, User, Message } from "@/lib/db/schema";

interface ChannelChatProps {
  channelId: string;
  channel: Channel | null;
}

interface MessageWithUser {
  message: Message;
  user: User | null;
}

export default function ChannelChat({ channelId, channel }: ChannelChatProps) {
  const { data: session } = authClient.useSession();
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Fetch initial messages
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await api.query("getMessages", {
          channelId,
          limit: 100,
        });

        if (cancelled) return;

        if (!result.success || !result.data) {
          setError(result.error?.message || "Failed to load messages");
          return;
        }

        setMessages(result.data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Connect to realtime channel
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    async function connectToChannel() {
      try {
        // Connect to the channel with user authentication
        const connectionResult = await api.connect(
          "chat",
          { channelId },
          { channelId, userId: session!.user!.id }
        );

        if (!connectionResult.success) {
          console.error("Failed to connect to channel:", connectionResult.error);
          return;
        }

        setToken(connectionResult.token);

        // Subscribe to messages
        unsubscribe = await api.subscribe(
          "chat",
          { channelId },
          connectionResult.token,
          (message) => {
            // Add new message to the list
            setMessages((prev) => [...prev, message]);
          }
        );
      } catch (err) {
        console.error("Failed to connect to realtime channel:", err);
      }
    }

    connectToChannel();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [channelId, session?.user?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || isSending || !session?.user?.id) {
      return;
    }

    try {
      setIsSending(true);

      // Send via mutation (which will broadcast to all clients)
      const result = await api.mutate("sendMessage", {
        channelId,
        content: messageInput.trim(),
      });

      if (result.success) {
        setMessageInput("");
      } else {
        console.error("Failed to send message:", result.error);
      }
    } catch (err) {
      console.error(`Unhandled failed to send message:`, err);
    } finally {
      setIsSending(false);
    }
  };

  // Show login prompt if not authenticated
  if (!session?.user) {
    return (
      <div className="flex-1 bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-base-content mb-2">Authentication Required</h2>
          <p className="text-base-content/70 mb-4">Please sign in to view and send messages</p>
          <a href="/auth" className="btn btn-primary">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-base-content/70 mt-4">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-error text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-base-content mb-2">Error Loading Messages</h2>
          <p className="text-base-content/70">{error}</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-base-content mb-2">Channel Not Found</h2>
          <p className="text-base-content/70">The channel you're looking for doesn't exist</p>
        </div>
      </div>
    );
  }

  // Transform messages for ChatArea component
  const chatMessages = messages.map((m) => ({
    id: m.message.id,
    userId: m.message.userId || "",
    channelId: m.message.channelId,
    content: m.message.content,
  }));

  const users = messages
    .map((m) => m.user)
    .filter((u): u is User => u !== null);

  return (
    <div className="flex-1 bg-base-200 flex flex-col">
      <div className="h-16 border-b border-base-content/20 flex items-center px-6">
        <span className="text-base-content/60 mr-2">#</span>
        <h2 className="text-base-content font-semibold text-lg">{channel.name}</h2>
        <div className="flex items-center ml-auto space-x-4">
          <button className="text-base-content/60 hover:text-base-content">📌</button>
          <button className="text-base-content/60 hover:text-base-content">👥</button>
          <button className="text-base-content/60 hover:text-base-content">📞</button>
          <button className="text-base-content/60 hover:text-base-content">🔍</button>
          <button className="text-base-content/60 hover:text-base-content">📥</button>
          <button className="text-base-content/60 hover:text-base-content">❓</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="text-center text-base-content/60 mt-8">
            <h3 className="text-xl font-semibold text-base-content mb-2">Welcome to #{channel.name}!</h3>
            <p>This is the beginning of the #{channel.name} channel.</p>
          </div>
        ) : (
          chatMessages.map((message) => {
            const user = users.find((u) => u.id === message.userId);
            return (
              <div key={message.id} className="flex items-start space-x-3 hover:bg-base-content/5 p-2 rounded">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-primary-content font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base-content font-semibold">{user?.name || "Unknown User"}</span>
                    <span className="text-base-content/60 text-xs">Today at 12:00 PM</span>
                  </div>
                  <p className="text-base-content/90">{message.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4">
        <form onSubmit={handleSendMessage}>
          <div className="bg-base-300 rounded-lg px-4 py-3">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message #${channel.name}`}
              className="w-full bg-transparent text-base-content placeholder-base-content/50 outline-none"
              disabled={isSending}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
