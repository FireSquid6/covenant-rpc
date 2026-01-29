'use client';

import { CovenantReactClient } from '@covenant/react';
import { httpClientToServer } from '@covenant/client/interfaces/http';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';
import { appCovenant } from '../covenant';

/**
 * Client-side Covenant client for React components
 *
 * This client is configured to:
 * - Use HTTP to communicate with the server at /api/covenant
 * - Include auth token from localStorage in all requests
 * - Not use realtime channels (emptyClientToSidekick)
 */

/**
 * Get the auth token from localStorage
 * Returns empty string if no token exists
 */
function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('authToken') || '';
}

/**
 * Create the Covenant React client
 *
 * NOTE: We create a new function that returns a connection with current headers
 * This allows the auth token to be dynamically updated
 */
function createClientConnection() {
  return httpClientToServer('/api/covenant', {
    Authorization: getAuthToken() ? `Bearer ${getAuthToken()}` : '',
  });
}

/**
 * Create the client instance
 */
export const client = new CovenantReactClient(appCovenant, {
  serverConnection: createClientConnection(),
  sidekickConnection: emptyClientToSidekick(),
});

/**
 * Update the client's auth token
 * Call this after login to refresh the client with the new token
 */
export function updateAuthToken(token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }

  // Recreate the server connection with new token
  // @ts-expect-error - We're accessing private property to update it
  client['serverConnection'] = createClientConnection();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Logout - clear auth token
 */
export function logout() {
  updateAuthToken(null);
}
