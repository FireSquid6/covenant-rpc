'use client';

import { CovenantReactClient } from '@covenant/react';
import { httpClientToServer } from '@covenant/client/interfaces/http';
import { httpClientToSidekick } from '@covenant/client/interfaces/http';
import { appCovenant } from '../covenant';

/**
 * Authentication token storage
 */
let authToken: string | null = null;

// Initialize token from localStorage (browser only)
if (typeof window !== 'undefined') {
  authToken = localStorage.getItem('authToken');
}

/**
 * Set the authentication token
 */
export function setAuthToken(token: string) {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
}

/**
 * Clear the authentication token
 */
export function clearAuthToken() {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
}

/**
 * Get the current authentication token
 */
export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Create the Covenant React client with HTTP connections
 *
 * Note: This connects to the HTTP server. For testing with InternalSidekick,
 * you would use directClientToServer and sidekick.getConnectionFromClient()
 */
export const client = new CovenantReactClient(appCovenant, {
  serverConnection: httpClientToServer(
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/covenant`
      : 'http://localhost:3000/api/covenant',
    {
      "Authorization": authToken ? `Bearer ${authToken}` : '',
    }
  ),
  // For production with separate Sidekick service, use httpClientToSidekick
  // For now, we'll use the same server endpoint (this won't actually work for WebSocket)
  // The plan doesn't require actual WebSocket connections, just resource tracking
  sidekickConnection: httpClientToSidekick('ws://localhost:3000/ws'),
});
