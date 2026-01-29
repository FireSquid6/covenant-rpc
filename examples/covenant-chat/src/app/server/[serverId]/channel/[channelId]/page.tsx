'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { client, getAuthToken, clearAuthToken } from '@/client/client';

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.serverId as string;
  const channelId = params.channelId as string;

  const [messageInput, setMessageInput] = useState('');
  const [channelToken, setChannelToken] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is authenticated
  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/login');
    }
  }, [router]);

  // Fetch channels for sidebar
  const channels = client.useQuery('getChannels', { serverId });

  // Fetch initial message history
  const messagesHistory = client.useQuery('getMessages', { channelId });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeMessages, messagesHistory.data]);

  /**
   * REALTIME CHANNEL CONNECTION
   * This is the key feature demonstrating Covenant's bidirectional WebSocket communication!
   */
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const connectToChannel = async () => {
      try {
        // Get username from token (in a real app, you'd decode the token or fetch user info)
        // For this example, we'll use a placeholder
        const username = 'User'; // In production, get this from auth context

        // 1. Connect to the channel
        const connectResult = await client.connect(
          'chat',
          { serverId, channelId },
          { username }
        );

        if (!connectResult.success) {
          setConnectionError(
            connectResult.error.message || 'Failed to connect to channel'
          );
          return;
        }

        setChannelToken(connectResult.token);
        setConnectionError(null);

        // 2. Subscribe to receive messages
        unsubscribe = await client.subscribe(
          'chat',
          { serverId, channelId },
          connectResult.token,
          (message) => {
            // Add new message to realtime messages
            setRealtimeMessages((prev) => [...prev, message]);
          }
        );
      } catch (err: any) {
        setConnectionError(err.message || 'Connection failed');
      }
    };

    connectToChannel();

    // Cleanup on unmount or when channel changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [serverId, channelId]);

  // Handle send message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !channelToken) return;

    try {
      // 3. Send message via channel
      await client.send(
        'chat',
        { serverId, channelId },
        channelToken,
        { content: messageInput }
      );

      setMessageInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Handle create channel
  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const result = await client.mutate('createChannel', {
      serverId,
      name: newChannelName,
    });

    if (result.success) {
      setNewChannelName('');
      // Navigate to the new channel
      router.push(`/server/${serverId}/channel/${result.data.id}`);
    }
  };

  // Handle logout
  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  // Combine history and realtime messages
  const allMessages = [
    ...(messagesHistory.data || []),
    ...realtimeMessages,
  ];

  // Loading state
  if (channels.loading || messagesHistory.loading) {
    return (
      <div className="chat-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Error state
  if (channels.error || messagesHistory.error) {
    return (
      <div className="container">
        <div className="error">
          Error: {channels.error?.message || messagesHistory.error?.message}
        </div>
        <button className="button button-secondary" onClick={handleLogout}>
          Back to Login
        </button>
      </div>
    );
  }

  const currentChannel = channels.data?.find((c) => c.id === channelId);

  return (
    <div className="chat-container">
      {/* Sidebar with channel list */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Channels</h2>
          <button
            className="button"
            style={{ fontSize: '12px', padding: '8px' }}
            onClick={() => router.push('/')}
          >
            Back to Servers
          </button>
        </div>

        <ul className="channel-list">
          {channels.data?.map((channel) => (
            <li
              key={channel.id}
              className={`channel-item ${
                channel.id === channelId ? 'active' : ''
              }`}
              onClick={() =>
                router.push(`/server/${serverId}/channel/${channel.id}`)
              }
            >
              # {channel.name}
            </li>
          ))}
        </ul>

        <div style={{ padding: '10px' }}>
          <form onSubmit={handleCreateChannel}>
            <input
              type="text"
              className="input"
              placeholder="New channel"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              style={{ fontSize: '12px', marginBottom: '5px' }}
            />
            <button
              type="submit"
              className="button"
              style={{ fontSize: '12px', width: '100%', padding: '8px' }}
            >
              Create Channel
            </button>
          </form>
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat-main">
        <div className="chat-header">
          <div>
            <h2># {currentChannel?.name}</h2>
            {connectionError && (
              <div style={{ color: '#dc3545', fontSize: '12px' }}>
                {connectionError}
              </div>
            )}
            {channelToken && !connectionError && (
              <div style={{ color: '#28a745', fontSize: '12px' }}>
                Connected to realtime channel
              </div>
            )}
          </div>
          <button className="button button-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="messages-container">
          {allMessages.length === 0 ? (
            <div className="empty-state">
              No messages yet. Be the first to say something!
            </div>
          ) : (
            allMessages.map((message, index) => (
              <div key={`${message.id}-${index}`} className="message">
                <div>
                  <span className="message-author">{message.username}</span>
                  <span className="message-timestamp">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">{message.content}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input-container">
          <form className="message-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="input message-input"
              placeholder={`Message #${currentChannel?.name}`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={!channelToken}
            />
            <button
              type="submit"
              className="button"
              disabled={!channelToken || !messageInput.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
