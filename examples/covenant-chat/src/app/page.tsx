'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { client, getAuthToken, clearAuthToken } from '@/client/client';

export default function ServerListPage() {
  const router = useRouter();
  const [newServerName, setNewServerName] = useState('');

  // Check if user is authenticated
  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/login');
    }
  }, [router]);

  /**
   * KEY FEATURE: useListenedQuery automatically refetches when mutations occur
   * that affect the same resources (servers/user/${userId})
   */
  const servers = client.useListenedQuery('getServers', null);

  // Handle logout
  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  // Handle create server
  const handleCreateServer = async (e: FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    const result = await client.mutate('createServer', {
      name: newServerName,
    });

    if (result.success) {
      setNewServerName('');
      // Navigate to the first channel in the new server
      // First we need to fetch channels
      const channelsResult = await client.query('getChannels', {
        serverId: result.data.id,
      });

      if (channelsResult.success && channelsResult.data.length > 0) {
        router.push(
          `/server/${result.data.id}/channel/${channelsResult.data[0].id}`
        );
      }
    }
  };

  // Handle server click
  const handleServerClick = async (serverId: string) => {
    // Get channels for this server
    const result = await client.query('getChannels', { serverId });

    if (result.success && result.data.length > 0) {
      // Navigate to first channel
      router.push(`/server/${serverId}/channel/${result.data[0].id}`);
    } else {
      // No channels yet, maybe show a message or create a default channel
      alert('This server has no channels yet. Create one!');
    }
  };

  // Loading state
  if (servers.loading) {
    return (
      <div className="container">
        <div className="loading">Loading servers...</div>
      </div>
    );
  }

  // Error state
  if (servers.error) {
    return (
      <div className="container">
        <div className="error">Error: {servers.error.message}</div>
        <button className="button button-secondary" onClick={handleLogout}>
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>My Servers</h1>
        <button className="button button-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Create Server Form */}
      <form className="form" onSubmit={handleCreateServer}>
        <input
          type="text"
          className="input"
          placeholder="Server name"
          value={newServerName}
          onChange={(e) => setNewServerName(e.target.value)}
        />
        <button type="submit" className="button">
          Create Server
        </button>
      </form>

      {/* Server List */}
      {servers.data.length === 0 ? (
        <div className="empty-state">
          No servers yet. Create one above to get started!
        </div>
      ) : (
        <ul className="server-list">
          {servers.data.map((server) => (
            <li
              key={server.id}
              className="server-item"
              onClick={() => handleServerClick(server.id)}
            >
              <strong>{server.name}</strong>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Created {new Date(server.createdAt).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ marginBottom: '10px', color: '#667eea' }}>
          Covenant Chat Example
        </h3>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
          This is a Discord-like chat application showcasing Covenant's realtime
          channels. Click on a server to join and start chatting!
        </p>
      </div>
    </div>
  );
}
