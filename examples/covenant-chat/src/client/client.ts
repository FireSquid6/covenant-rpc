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
 * Create the Covenant React client with HTTP and WebSocket connections
 *
 * For the chat example, we need full WebSocket support via Sidekick.
 * In a production setup, the sidekick would be a separate service.
 * For this example, we're using InternalSidekick which is co-located with the server.
 *
 * Note: The WebSocket connection needs to be to a proper WebSocket endpoint.
 * In production, you'd have a separate sidekick service at ws://sidekick.example.com
 * For development with InternalSidekick, this would need special handling.
 */
export const client = new CovenantReactClient(appCovenant, {
  serverConnection: httpClientToServer(
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/covenant`
      : 'http://localhost:3000/api/covenant',
    {
      headers: () => ({
        Authorization: authToken ? `Bearer ${authToken}` : '',
      }),
    }
  ),
  // WebSocket connection for realtime channels
  // NOTE: In this example, we'll need to set up a WebSocket endpoint
  // For InternalSidekick to work in production, you'd typically:
  // 1. Use a separate sidekick service with httpClientToSidekick
  // 2. Or expose the InternalSidekick via a WebSocket endpoint
  sidekickConnection: httpClientToSidekick(
    typeof window !== 'undefined'
      ? `ws://${window.location.host}/api/ws`
      : 'ws://localhost:3000/api/ws'
  ),
});
