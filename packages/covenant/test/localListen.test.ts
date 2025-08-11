import { test, expect, mock } from "bun:test";
import { z } from "zod";
import { declareCovenant, query, mutation } from "../lib/index";
import { CovenantClient, directMessenger, type ClientMessenger } from "../lib/client";
import { CovenantServer } from "../lib/server";
import type { ProcedureRequest } from "../lib/request";

// Test covenant with procedures that have different resource patterns
const listenTestCovenant = declareCovenant({
  procedures: {
    getUser: query({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
      resources: (inputs) => [`user:${inputs.id}`]
    }),
    getUserProfile: query({
      input: z.object({ userId: z.string() }),
      output: z.object({ userId: z.string(), bio: z.string(), avatar: z.string() }),
      resources: (inputs) => [`user:${inputs.userId}`, `profile:${inputs.userId}`]
    }),
    listUsers: query({
      input: z.object({ limit: z.number().optional() }),
      output: z.object({ users: z.array(z.object({ id: z.string(), name: z.string() })) }),
      resources: () => ["user:*"]
    }),
    updateUser: mutation({
      input: z.object({ id: z.string(), name: z.string() }),
      output: z.object({ success: z.boolean() }),
      resources: (inputs) => [`user:${inputs.id}`]
    }),
    deleteUser: mutation({
      input: z.object({ id: z.string() }),
      output: z.object({ deleted: z.boolean() }),
      resources: (inputs) => [`user:${inputs.id}`, "user:*"]
    }),
    createUser: mutation({
      input: z.object({ name: z.string(), email: z.string() }),
      output: z.object({ id: z.string(), created: z.boolean() }),
      resources: () => ["user:*"]
    })
  },
  channels: {}
});

function createMockClient(mockResponses: { [procedure: string]: any }) {
  const mockMessenger: ClientMessenger = {
    fetch: mock((request: ProcedureRequest) => {
      const response = mockResponses[request.procedure];
      if (!response) {
        return Promise.resolve(Response.json({
          result: "ERROR",
          error: { message: "Procedure not found", httpCode: 404 },
          data: undefined
        }, { status: 404 }));
      }
      
      return Promise.resolve(Response.json({
        result: "OK",
        error: undefined,
        data: response
      }, { status: 201 }));
    })
  };
  
  return new CovenantClient(listenTestCovenant, mockMessenger);
}

test("localListen should set up a listener for query procedures", async () => {
  const mockUserData = { id: "user1", name: "Alice", email: "alice@example.com" };
  const client = createMockClient({ getUser: mockUserData });
  
  const callback = mock();
  const unsubscribe = client.localListen("getUser", { id: "user1" }, callback);
  
  // Wait a tick for the initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith({
    result: "OK",
    error: undefined,
    data: mockUserData
  });
  
  expect(typeof unsubscribe).toBe("function");
});

test("localListen should throw error for mutation procedures", () => {
  const client = createMockClient({});
  const callback = mock();
  
  expect(() => {
    client.localListen("updateUser" as any, { id: "user1", name: "Bob" }, callback);
  }).toThrow("Tried to listen to a mutation which makes no sense");
});

test("localListen should call callback when resources are invalidated", async () => {
  let userCounter = 0;
  const getUserResponse = () => ({
    id: "user1",
    name: `User ${++userCounter}`,
    email: "user@example.com"
  });
  
  const client = createMockClient({
    getUser: getUserResponse(),
    updateUser: { success: true }
  });
  
  const callback = mock();
  client.localListen("getUser", { id: "user1" }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][0].data.name).toBe("User 1");
  
  // Update the mock response for subsequent calls
  const mockMessenger = (client as any).messenger;
  mockMessenger.fetch.mockImplementation((request: ProcedureRequest) => {
    if (request.procedure === "getUser") {
      return Promise.resolve(Response.json({
        result: "OK",
        error: undefined,
        data: getUserResponse()
      }, { status: 201 }));
    }
    return Promise.resolve(Response.json({
      result: "OK",
      error: undefined,
      data: { success: true }
    }, { status: 201 }));
  });
  
  // Trigger mutation that affects the same resource
  await client.mutate("updateUser", { id: "user1", name: "Updated Name" });
  
  // Wait for refetch to complete
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback.mock.calls[1][0].data.name).toBe("User 2");
});

test("localListen should handle multiple listeners on the same resource", async () => {
  const mockUserData = { id: "user1", name: "Alice", email: "alice@example.com" };
  const client = createMockClient({
    getUser: mockUserData,
    updateUser: { success: true }
  });
  
  const callback1 = mock();
  const callback2 = mock();
  
  client.localListen("getUser", { id: "user1" }, callback1);
  client.localListen("getUser", { id: "user1" }, callback2);
  
  // Wait for initial calls
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(callback1).toHaveBeenCalledTimes(1);
  expect(callback2).toHaveBeenCalledTimes(1);
  
  // Trigger mutation
  await client.mutate("updateUser", { id: "user1", name: "Updated" });
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(callback1).toHaveBeenCalledTimes(2);
  expect(callback2).toHaveBeenCalledTimes(2);
});

test("localListen should handle wildcard resource matching", async () => {
  const mockListData = { users: [{ id: "user1", name: "Alice" }] };
  const client = createMockClient({
    listUsers: mockListData,
    createUser: { id: "user2", created: true }
  });
  
  const callback = mock();
  client.localListen("listUsers", { limit: 10 }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callback).toHaveBeenCalledTimes(1);
  
  // Create user affects "user:*" resource, should trigger listUsers listener
  await client.mutate("createUser", { name: "Bob", email: "bob@example.com" });
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(callback).toHaveBeenCalledTimes(2);
});

test("localListen should handle multiple resources per procedure", async () => {
  const mockProfileData = { userId: "user1", bio: "Test bio", avatar: "avatar.jpg" };
  const client = createMockClient({
    getUserProfile: mockProfileData,
    updateUser: { success: true }
  });
  
  const callback = mock();
  client.localListen("getUserProfile", { userId: "user1" }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callback).toHaveBeenCalledTimes(1);
  
  // Update user affects "user:user1" resource, should trigger profile listener
  await client.mutate("updateUser", { id: "user1", name: "Updated Name" });
  await new Promise(resolve => setTimeout(resolve, 10));
  
  expect(callback).toHaveBeenCalledTimes(2);
});

test("localListen unsubscribe function should stop listening", async () => {
  const mockUserData = { id: "user1", name: "Alice", email: "alice@example.com" };
  const client = createMockClient({
    getUser: mockUserData,
    updateUser: { success: true }
  });
  
  const callback = mock();
  const unsubscribe = client.localListen("getUser", { id: "user1" }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callback).toHaveBeenCalledTimes(1);
  
  // Unsubscribe
  unsubscribe();
  
  // Trigger mutation
  await client.mutate("updateUser", { id: "user1", name: "Updated" });
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Should still only have been called once (the initial call)
  expect(callback).toHaveBeenCalledTimes(1);
});

test("localListen should not trigger for unrelated resource changes", async () => {
  const mockUser1Data = { id: "user1", name: "Alice", email: "alice@example.com" };
  const client = createMockClient({
    getUser: mockUser1Data,
    updateUser: { success: true }
  });
  
  const callback = mock();
  client.localListen("getUser", { id: "user1" }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(callback).toHaveBeenCalledTimes(1);
  
  // Update a different user (different resource)
  await client.mutate("updateUser", { id: "user2", name: "Bob Updated" });
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Should still only have been called once (no resource overlap)
  expect(callback).toHaveBeenCalledTimes(1);
});

test("localListen should handle async callbacks", async () => {
  const mockUserData = { id: "user1", name: "Alice", email: "alice@example.com" };
  const client = createMockClient({
    getUser: mockUserData,
    updateUser: { success: true }
  });
  
  const asyncCallback = mock(async (data) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    // Some async operation
  });
  
  client.localListen("getUser", { id: "user1" }, asyncCallback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(asyncCallback).toHaveBeenCalledTimes(1);
  
  // Trigger mutation
  await client.mutate("updateUser", { id: "user1", name: "Updated" });
  await new Promise(resolve => setTimeout(resolve, 20));
  
  expect(asyncCallback).toHaveBeenCalledTimes(2);
});

test("localListen should handle error responses", async () => {
  const client = createMockClient({});  // No mock responses - will return 404
  
  const callback = mock();
  client.localListen("getUser", { id: "nonexistent" }, callback);
  
  // Wait for initial call
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith({
    result: "ERROR",
    error: { message: "Procedure not found", httpCode: 404 },
    data: undefined
  });
});