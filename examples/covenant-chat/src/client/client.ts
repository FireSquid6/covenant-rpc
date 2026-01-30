'use client';

import { CovenantReactClient } from '@covenant/react';
import { httpClientToServer } from '@covenant/client/interfaces/http';
import { httpClientToSidekick } from '@covenant/client/interfaces/http';
import { appCovenant } from '../covenant';

/**
 * Get the authentication token from localStorage
 */
function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('authToken') || '';
}

/**
 * Create the server connection with current auth headers
 */
function createServerConnection() {
  return httpClientToServer(
    '/api/covenant',
    {
      Authorization: getAuthToken() ? `Bearer ${getAuthToken()}` : '',
    }
  );
}

/**
 * Create the Covenant React client with HTTP and WebSocket connections
 */
export const client = new CovenantReactClient(appCovenant, {
  serverConnection: createServerConnection(),
  sidekickConnection: httpClientToSidekick(
    typeof window !== 'undefined'
      ? `ws://${window.location.host}/api/ws`
      : 'ws://localhost:3000/api/ws'
  ),
});

/**
 * Set the authentication token and update client connection
 */
export function setAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('authToken', token);

  // Recreate the server connection with new token
  // @ts-expect-error - accessing private property to update connection
  client['serverConnection'] = createServerConnection();
}

/**
 * Clear the authentication token and update client connection
 */
export function clearAuthToken() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('authToken');

  // Recreate the server connection without token
  // @ts-expect-error - accessing private property to update connection
  client['serverConnection'] = createServerConnection();
}

export { getAuthToken };
