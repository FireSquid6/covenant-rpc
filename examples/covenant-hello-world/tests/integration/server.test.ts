import { test, expect } from 'bun:test';
import { server } from '../../src/server/server';
import { CovenantClient } from '@covenant/client';
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { emptyClientToSidekick } from '@covenant/client/interfaces/empty';
import { appCovenant } from '../../src/covenant';
import { Database } from 'bun:sqlite';
import path from 'path';

/**
 * Integration tests for the full server setup
 *
 * These tests verify that the actual server implementation works correctly
 * with the real database and auth logic.
 */

test('full authentication flow', async () => {
  // Create a client connected to the actual server
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  // Step 1: Try to access getHello without authentication - should fail
  const unauthResult = await client.query('getHello', null);
  expect(unauthResult.success).toBe(false);
  if (!unauthResult.success) {
    expect(unauthResult.error.code).toBe(401);
  }

  // Step 2: Login with valid credentials
  const loginResult = await client.mutate('login', {
    username: 'testuser',
    password: 'password123',
  });

  expect(loginResult.success).toBe(true);
  if (!loginResult.success) {
    throw new Error('Login failed: ' + loginResult.error.message);
  }

  const authToken = loginResult.data.token;
  expect(authToken).toBeTruthy();
  expect(loginResult.data.username).toBe('testuser');

  // Step 3: Create a new client with auth token
  const authedClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {
      Authorization: `Bearer ${authToken}`,
    }),
    sidekickConnection: emptyClientToSidekick(),
  });

  // Step 4: Access getHello with authentication - should succeed
  const helloResult = await authedClient.query('getHello', null);
  expect(helloResult.success).toBe(true);
  if (helloResult.success) {
    expect(helloResult.data.username).toBe('testuser');
    expect(helloResult.data.message).toContain('Hello, testuser!');
    expect(helloResult.resources).toEqual(['user/test-user-1']);
  }
});

test('login with invalid credentials fails', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: emptyClientToSidekick(),
  });

  // Test wrong username
  const result1 = await client.mutate('login', {
    username: 'nonexistent',
    password: 'password123',
  });

  expect(result1.success).toBe(false);
  if (!result1.success) {
    expect(result1.error.code).toBe(401);
    expect(result1.error.message).toBe('Invalid username or password');
  }

  // Test wrong password
  const result2 = await client.mutate('login', {
    username: 'testuser',
    password: 'wrongpassword',
  });

  expect(result2.success).toBe(false);
  if (!result2.success) {
    expect(result2.error.code).toBe(401);
    expect(result2.error.message).toBe('Invalid username or password');
  }
});

test('HTTP handler returns proper response', async () => {
  // Create a mock HTTP request
  const request = new Request('http://localhost:3000/api/covenant?type=procedure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      procedure: 'login',
      inputs: {
        username: 'testuser',
        password: 'password123',
      },
    }),
  });

  const response = await server.handle(request);

  // Mutations return 201, queries return 200
  expect(response.status).toBe(201);
  expect(response.headers.get('Content-Type')).toContain('application/json');

  const data = await response.json();
  expect(data).toHaveProperty('status', 'OK');
  expect(data).toHaveProperty('data');
  expect(data.data).toHaveProperty('token');
  expect(data.data).toHaveProperty('username', 'testuser');
});

test('invalid token results in 401', async () => {
  const client = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {
      headers: new Headers({
        Authorization: 'Bearer invalid-token',
      }),
    }),
    sidekickConnection: emptyClientToSidekick(),
  });

  const result = await client.query('getHello', null);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.code).toBe(401);
  }
});
