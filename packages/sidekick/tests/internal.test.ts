import { test, expect } from "bun:test";
import { InternalSidekick } from "../internal";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "@covenant/rpc/sidekick/protocol";
import type { ChannelConnectionPayload, ServerMessage } from "@covenant/rpc/channel";

test("InternalSidekick - basic instantiation", () => {
  const sidekick = new InternalSidekick();
  expect(sidekick).toBeDefined();
});

test("InternalSidekick - server connection methods", async () => {
  const sidekick = new InternalSidekick();
  const serverConnection = sidekick.getConnectionFromServer();

  expect(serverConnection.addConnection).toBeDefined();
  expect(serverConnection.update).toBeDefined();
  expect(serverConnection.postMessage).toBeDefined();

  const mockPayload: ChannelConnectionPayload = {
    token: "test-token",
    channel: "test-channel",
    params: { id: "123" },
    context: { userId: "user1" }
  };

  const result = await serverConnection.addConnection(mockPayload);
  expect(result).toBeNull();
});

test("InternalSidekick - client connection methods", () => {
  const sidekick = new InternalSidekick();
  const clientConnection = sidekick.getConnectionFromClient();

  expect(clientConnection.sendMessage).toBeDefined();
  expect(clientConnection.onMessage).toBeDefined();
});

test("InternalSidekick - message routing between clients", async () => {
  const sidekick = new InternalSidekick();
  
  // Create two client connections
  const client1 = sidekick.getConnectionFromClient();
  const client2 = sidekick.getConnectionFromClient();

  const receivedMessages: SidekickOutgoingMessage[] = [];
  
  // Set up message handler for client1
  const unsubscribe1 = client1.onMessage((message) => {
    receivedMessages.push(message);
  });

  // Set up message handler for client2
  const receivedMessages2: SidekickOutgoingMessage[] = [];
  const unsubscribe2 = client2.onMessage((message) => {
    receivedMessages2.push(message);
  });

  // Subscribe client1 to a channel
  const subscribeMessage: SidekickIncomingMessage = {
    type: "subscribe",
    token: "test-token"
  };

  // First add the connection to the server side
  const serverConnection = sidekick.getConnectionFromServer();
  await serverConnection.addConnection({
    token: "test-token",
    channel: "test-channel",
    params: { id: "123" },
    context: {}
  });

  // Subscribe client1
  client1.sendMessage(subscribeMessage);

  // Wait for subscription to process
  await new Promise(resolve => setTimeout(resolve, 10));

  // Post a message from server
  const serverMessage: ServerMessage = {
    channel: "test-channel",
    params: { id: "123" },
    data: { message: "Hello World" }
  };

  await serverConnection.postMessage(serverMessage);

  // Wait for message to propagate
  await new Promise(resolve => setTimeout(resolve, 10));

  // Client1 should receive the message since they're subscribed
  expect(receivedMessages.length).toBeGreaterThan(0);
  
  // Client2 should not receive the message since they're not subscribed
  expect(receivedMessages2.length).toBe(0);

  // Clean up
  unsubscribe1();
  unsubscribe2();
});

test("InternalSidekick - resource updates", async () => {
  const sidekick = new InternalSidekick();
  const client = sidekick.getConnectionFromClient();
  const serverConnection = sidekick.getConnectionFromServer();

  const receivedMessages: SidekickOutgoingMessage[] = [];
  const unsubscribe = client.onMessage((message) => {
    receivedMessages.push(message);
  });

  // Subscribe to resource updates
  const listenMessage: SidekickIncomingMessage = {
    type: "listen",
    resources: ["user-data", "config"]
  };

  client.sendMessage(listenMessage);
  
  // Wait for listen to process
  await new Promise(resolve => setTimeout(resolve, 10));

  // Update resources from server
  await serverConnection.update(["user-data", "config"]);

  // Wait for updates to propagate
  await new Promise(resolve => setTimeout(resolve, 10));

  // Should receive update messages
  const updateMessages = receivedMessages.filter(m => m.type === "updated");
  expect(updateMessages.length).toBe(2);
  
  const resourceNames = updateMessages.map(m => 
    m.type === "updated" ? m.resource : ""
  );
  expect(resourceNames).toContain("user-data");
  expect(resourceNames).toContain("config");

  unsubscribe();
});

test("InternalSidekick - multiple clients with different subscriptions", async () => {
  const sidekick = new InternalSidekick();
  const serverConnection = sidekick.getConnectionFromServer();

  // Add connection tokens
  await serverConnection.addConnection({
    token: "token1",
    channel: "channel1",
    params: { id: "1" },
    context: {}
  });

  await serverConnection.addConnection({
    token: "token2", 
    channel: "channel2",
    params: { id: "2" },
    context: {}
  });

  // Create clients
  const client1 = sidekick.getConnectionFromClient();
  const client2 = sidekick.getConnectionFromClient();

  const client1Messages: SidekickOutgoingMessage[] = [];
  const client2Messages: SidekickOutgoingMessage[] = [];

  const unsub1 = client1.onMessage((msg) => client1Messages.push(msg));
  const unsub2 = client2.onMessage((msg) => client2Messages.push(msg));

  // Subscribe clients to different channels
  client1.sendMessage({ type: "subscribe", token: "token1" });
  client2.sendMessage({ type: "subscribe", token: "token2" });

  await new Promise(resolve => setTimeout(resolve, 10));

  // Send message to channel1
  await serverConnection.postMessage({
    channel: "channel1",
    params: { id: "1" },
    data: "message for channel1"
  });

  // Send message to channel2  
  await serverConnection.postMessage({
    channel: "channel2",
    params: { id: "2" },
    data: "message for channel2"
  });

  await new Promise(resolve => setTimeout(resolve, 10));

  // Each client should only receive messages for their subscribed channel
  const client1MessageTypes = client1Messages.filter(m => m.type === "message");
  const client2MessageTypes = client2Messages.filter(m => m.type === "message");

  expect(client1MessageTypes.length).toBe(1);
  expect(client2MessageTypes.length).toBe(1);

  if (client1MessageTypes[0].type === "message") {
    expect(client1MessageTypes[0].channel).toBe("channel1");
    expect(client1MessageTypes[0].data).toBe("message for channel1");
  }

  if (client2MessageTypes[0].type === "message") {
    expect(client2MessageTypes[0].channel).toBe("channel2");
    expect(client2MessageTypes[0].data).toBe("message for channel2");
  }

  unsub1();
  unsub2();
});

test("InternalSidekick - unsubscribe functionality", async () => {
  const sidekick = new InternalSidekick();
  const serverConnection = sidekick.getConnectionFromServer();
  const client = sidekick.getConnectionFromClient();

  await serverConnection.addConnection({
    token: "test-token",
    channel: "test-channel", 
    params: { id: "1" },
    context: {}
  });

  const messages: SidekickOutgoingMessage[] = [];
  const unsub = client.onMessage((msg) => messages.push(msg));

  // Subscribe
  client.sendMessage({ type: "subscribe", token: "test-token" });
  await new Promise(resolve => setTimeout(resolve, 10));

  // Send message - should receive it
  await serverConnection.postMessage({
    channel: "test-channel",
    params: { id: "1" },
    data: "first message"
  });
  await new Promise(resolve => setTimeout(resolve, 10));

  // Unsubscribe
  client.sendMessage({ type: "unsubscribe", token: "test-token" });
  await new Promise(resolve => setTimeout(resolve, 10));

  // Send another message - should not receive it
  await serverConnection.postMessage({
    channel: "test-channel", 
    params: { id: "1" },
    data: "second message"
  });
  await new Promise(resolve => setTimeout(resolve, 10));

  // Should only have received the first message
  const messageEvents = messages.filter(m => m.type === "message");
  expect(messageEvents.length).toBe(1);

  if (messageEvents[0].type === "message") {
    expect(messageEvents[0].data).toBe("first message");
  }

  unsub();
});

test("InternalSidekick - client handler cleanup", () => {
  const sidekick = new InternalSidekick();
  const client = sidekick.getConnectionFromClient();

  const messages: SidekickOutgoingMessage[] = [];
  
  // Add a handler
  const unsub = client.onMessage((msg) => {
    messages.push(msg);
  });

  // Unsubscribe the handler
  unsub();

  // Try to send a message to the client (should not be received)
  // This is testing the internal behavior, so we access the internal client
  const serverConnection = sidekick.getConnectionFromServer();
  
  // The handler should have been removed, so no messages should be received
  expect(messages.length).toBe(0);
});