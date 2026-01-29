import { test, expect } from 'bun:test';
import { CovenantClient } from '@covenant/client';
import { InternalSidekick } from '@covenant/sidekick/internal';
import { directClientToServer } from '@covenant/server/interfaces/direct';
import { appCovenant } from '../../src/covenant';
import { server } from '../../src/server/server';

/**
 * Integration test for full realtime chat flow
 *
 * This test demonstrates the complete user journey:
 * 1. Two users log in
 * 2. One creates a server and channel
 * 3. Both join the channel
 * 4. They exchange messages in realtime
 * 5. Messages are persisted and can be retrieved
 */

test('full realtime chat flow - two users exchanging messages', async () => {
  // Create clients for Alice and Bob
  const aliceLoginClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: (await import('../../src/server/server')).sidekick.getConnectionFromClient(),
  });

  const bobLoginClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {}),
    sidekickConnection: (await import('../../src/server/server')).sidekick.getConnectionFromClient(),
  });

  // Step 1: Both users log in
  const aliceLogin = await aliceLoginClient.mutate('login', {
    username: 'alice',
    password: 'password',
  });
  expect(aliceLogin.success).toBe(true);

  const bobLogin = await bobLoginClient.mutate('login', {
    username: 'bob',
    password: 'password',
  });
  expect(bobLogin.success).toBe(true);

  // Create authenticated clients
  const aliceClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {
      Authorization: `Bearer ${aliceLogin.data.token}`,
    }),
    sidekickConnection: (await import('../../src/server/server')).sidekick.getConnectionFromClient(),
  });

  const bobClient = new CovenantClient(appCovenant, {
    serverConnection: directClientToServer(server, {
      Authorization: `Bearer ${bobLogin.data.token}`,
    }),
    sidekickConnection: (await import('../../src/server/server')).sidekick.getConnectionFromClient(),
  });

  // Step 2: Alice creates a server
  const serverResult = await aliceClient.mutate('createServer', {
    name: 'Integration Test Server',
  });
  expect(serverResult.success).toBe(true);
  const serverId = serverResult.data.id;

  // Step 3: Alice creates a channel
  const channelResult = await aliceClient.mutate('createChannel', {
    serverId,
    name: 'general',
  });
  expect(channelResult.success).toBe(true);
  const channelId = channelResult.data.id;

  // Step 4: Both users connect to the channel
  const aliceConnect = await aliceClient.connect(
    'chat',
    { serverId, channelId },
    { username: 'alice' }
  );
  expect(aliceConnect.success).toBe(true);

  const bobConnect = await bobClient.connect(
    'chat',
    { serverId, channelId },
    { username: 'bob' }
  );
  expect(bobConnect.success).toBe(true);

  // Step 5: Set up message collectors
  const aliceMessages: any[] = [];
  const bobMessages: any[] = [];

  // Both subscribe to messages
  await aliceClient.subscribe(
    'chat',
    { serverId, channelId },
    aliceConnect.token,
    (message) => aliceMessages.push(message)
  );

  await bobClient.subscribe(
    'chat',
    { serverId, channelId },
    bobConnect.token,
    (message) => bobMessages.push(message)
  );

  // Step 6: Alice sends a message
  await aliceClient.send(
    'chat',
    { serverId, channelId },
    aliceConnect.token,
    { content: 'Hey Bob!' }
  );

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Both should receive Alice's message
  expect(aliceMessages).toHaveLength(1);
  expect(aliceMessages[0].content).toBe('Hey Bob!');
  expect(aliceMessages[0].username).toBe('alice');

  expect(bobMessages).toHaveLength(1);
  expect(bobMessages[0].content).toBe('Hey Bob!');
  expect(bobMessages[0].username).toBe('alice');

  // Step 7: Bob replies
  await bobClient.send(
    'chat',
    { serverId, channelId },
    bobConnect.token,
    { content: 'Hey Alice!' }
  );

  // Wait for broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Both should now have 2 messages
  expect(aliceMessages).toHaveLength(2);
  expect(aliceMessages[1].content).toBe('Hey Alice!');
  expect(aliceMessages[1].username).toBe('bob');

  expect(bobMessages).toHaveLength(2);
  expect(bobMessages[1].content).toBe('Hey Alice!');
  expect(bobMessages[1].username).toBe('bob');

  // Step 8: Verify message persistence
  const messagesResult = await aliceClient.query('getMessages', { channelId });
  expect(messagesResult.success).toBe(true);
  expect(messagesResult.data).toHaveLength(2);
  expect(messagesResult.data[0].content).toBe('Hey Bob!');
  expect(messagesResult.data[1].content).toBe('Hey Alice!');

  console.log('✓ Full realtime chat flow completed successfully!');
  console.log('  - Both users logged in');
  console.log('  - Server and channel created');
  console.log('  - Both users connected to channel');
  console.log('  - Messages exchanged in realtime');
  console.log('  - Messages persisted to database');
});
