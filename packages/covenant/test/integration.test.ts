import { test, expect, mock } from "bun:test";
import { z } from "zod";
import { declareCovenant } from "../lib/index";
import { CovenantClient, directMessenger, httpMessenger } from "../lib/client";
import { CovenantServer, type ProcedureInputs } from "../lib/server";
import { CovenantError } from "../lib/error";

// Comprehensive test covenant
const integrationCovenant = declareCovenant({
  procedures: {
    getUser: {
      type: "query" as const,
      input: z.object({ id: z.string() }),
      output: z.object({ 
        id: z.string(), 
        name: z.string(), 
        email: z.string(), 
        active: z.boolean() 
      })
    },
    createUser: {
      type: "mutation" as const,
      input: z.object({ 
        name: z.string().min(1), 
        email: z.string().email() 
      }),
      output: z.object({ 
        id: z.string(), 
        created: z.boolean(),
        timestamp: z.number()
      })
    },
    updateUser: {
      type: "mutation" as const,
      input: z.object({ 
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional()
      }),
      output: z.object({ 
        id: z.string(),
        updated: z.boolean()
      })
    },
    deleteUser: {
      type: "mutation" as const,
      input: z.object({ id: z.string() }),
      output: z.object({ deleted: z.boolean() })
    },
    listUsers: {
      type: "query" as const,
      input: z.object({ 
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional()
      }),
      output: z.object({
        users: z.array(z.object({
          id: z.string(),
          name: z.string(),
          email: z.string()
        })),
        total: z.number(),
        hasMore: z.boolean()
      })
    },
    authRequired: {
      type: "mutation" as const,
      input: z.object({ action: z.string() }),
      output: z.object({ authorized: z.boolean(), user: z.string() })
    }
  },
  channels: {}
});

// Mock database
const mockUsers = new Map([
  ["user1", { id: "user1", name: "Alice Smith", email: "alice@example.com", active: true }],
  ["user2", { id: "user2", name: "Bob Johnson", email: "bob@example.com", active: true }],
  ["user3", { id: "user3", name: "Charlie Brown", email: "charlie@example.com", active: false }]
]);

function createTestServer() {
  const contextGenerator = mock(({ request }: ProcedureInputs<unknown, undefined>) => {
    const authHeader = request.headers.get("Authorization");
    return {
      userId: authHeader ? authHeader.replace("Bearer ", "") : null,
      timestamp: Date.now()
    };
  });

  const server = new CovenantServer(integrationCovenant, { contextGenerator });

  // Define all procedures
  server.defineProcedure("getUser", async ({ inputs }: any) => {
    const user = mockUsers.get(inputs.id);
    if (!user) {
      throw new CovenantError("User not found", 404);
    }
    return user;
  });

  server.defineProcedure("createUser", async ({ inputs, ctx }: any) => {
    const id = `user${mockUsers.size + 1}`;
    const user = {
      id,
      name: inputs.name,
      email: inputs.email,
      active: true
    };
    mockUsers.set(id, user);
    
    return {
      id,
      created: true,
      timestamp: ctx.timestamp
    };
  });

  server.defineProcedure("updateUser", async ({ inputs }: any) => {
    const user = mockUsers.get(inputs.id);
    if (!user) {
      throw new CovenantError("User not found", 404);
    }
    
    if (inputs.name) user.name = inputs.name;
    if (inputs.email) user.email = inputs.email;
    mockUsers.set(inputs.id, user);
    
    return { id: inputs.id, updated: true };
  });

  server.defineProcedure("deleteUser", async ({ inputs }: any) => {
    const existed = mockUsers.delete(inputs.id);
    return { deleted: existed };
  });

  server.defineProcedure("listUsers", async ({ inputs }: any) => {
    const allUsers = Array.from(mockUsers.values());
    const limit = inputs.limit ?? 10;
    const offset = inputs.offset ?? 0;
    const users = allUsers.slice(offset, offset + limit);
    
    return {
      users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
      total: allUsers.length,
      hasMore: offset + limit < allUsers.length
    };
  });

  server.defineProcedure("authRequired", async ({ inputs, ctx, error }: any) => {
    if (!ctx.userId) {
      error("Authentication required", 401);
    }
    
    return {
      authorized: true,
      user: ctx.userId!
    };
  });

  return server;
}

test("End-to-end client-server communication using direct messenger", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Test successful user retrieval
  const result = await client.call("getUser", { id: "user1" });
  
  expect(result.result).toBe("OK");
  expect(result.data).toEqual({
    id: "user1",
    name: "Alice Smith",
    email: "alice@example.com",
    active: true
  });
});

test("End-to-end error handling", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Test user not found
  const result = await client.call("getUser", { id: "nonexistent" });
  
  expect(result.result).toBe("ERROR");
  expect(result.error?.message).toBe("User not found");
  expect(result.error?.httpCode).toBe(404);
  expect(result.data).toBeUndefined();
});

test("End-to-end user creation and retrieval", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Create a new user
  const createResult = await client.call("createUser", {
    name: "David Wilson",
    email: "david@example.com"
  });
  
  expect(createResult.result).toBe("OK");
  expect((createResult.data as any)?.created).toBe(true);
  expect(typeof (createResult.data as any)?.id).toBe("string");
  expect(typeof (createResult.data as any)?.timestamp).toBe("number");
  
  // Retrieve the created user
  const userId = (createResult.data as any)!.id;
  const getResult = await client.call("getUser", { id: userId });
  
  expect(getResult.result).toBe("OK");
  expect((getResult.data as any)?.name).toBe("David Wilson");
  expect((getResult.data as any)?.email).toBe("david@example.com");
  expect((getResult.data as any)?.active).toBe(true);
});

test("End-to-end user update flow", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Update existing user
  const updateResult = await client.call("updateUser", {
    id: "user2",
    name: "Robert Johnson",
    email: "robert@example.com"
  });
  
  expect(updateResult.result).toBe("OK");
  expect((updateResult.data as any)?.updated).toBe(true);
  
  // Verify the update
  const getResult = await client.call("getUser", { id: "user2" });
  
  expect(getResult.result).toBe("OK");
  expect((getResult.data as any)?.name).toBe("Robert Johnson");
  expect((getResult.data as any)?.email).toBe("robert@example.com");
});

test("End-to-end user deletion", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Delete user
  const deleteResult = await client.call("deleteUser", { id: "user3" });
  
  expect(deleteResult.result).toBe("OK");
  expect((deleteResult.data as any)?.deleted).toBe(true);
  
  // Verify user is gone
  const getResult = await client.call("getUser", { id: "user3" });
  
  expect(getResult.result).toBe("ERROR");
  expect(getResult.error?.httpCode).toBe(404);
});

test("End-to-end list users with pagination", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // List first page
  const listResult = await client.call("listUsers", { limit: 2, offset: 0 });
  
  expect(listResult.result).toBe("OK");
  expect((listResult.data as any)?.users).toHaveLength(2);
  expect((listResult.data as any)?.total).toBeGreaterThanOrEqual(2);
  expect(typeof (listResult.data as any)?.hasMore).toBe("boolean");
  
  // Verify user structure
  const firstUser = (listResult.data as any)?.users[0];
  expect(firstUser).toHaveProperty("id");
  expect(firstUser).toHaveProperty("name");
  expect(firstUser).toHaveProperty("email");
});

test("End-to-end authentication flow", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Test without authentication
  const noAuthResult = await client.call("authRequired", { action: "test" });
  
  expect(noAuthResult.result).toBe("ERROR");
  expect(noAuthResult.error?.httpCode).toBe(401);
  expect(noAuthResult.error?.message).toBe("Authentication required");
});

test("callUnwrap integration test", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Test successful unwrap
  const userData = await client.callUnwrap("getUser", { id: "user1" });
  
  expect(userData).toEqual({
    id: "user1",
    name: "Alice Smith",
    email: "alice@example.com",
    active: true
  });
  
  // Test error unwrap
  await expect(client.callUnwrap("getUser", { id: "nonexistent" }))
    .rejects.toThrow("Unwrapped an error calling getUser (404): User not found");
});

test("Input validation integration test", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Test invalid email format
  const result = await client.call("createUser", {
    name: "Test User",
    email: "invalid-email" as any // Testing runtime validation
  });
  
  expect(result.result).toBe("ERROR");
  expect(result.error?.httpCode).toBe(400);
  expect(result.error?.message).toContain("Error parsing procedure inputs");
});

test("Complex data structures integration test", async () => {
  const server = createTestServer();
  const client = new CovenantClient(integrationCovenant, directMessenger(server));
  
  // Create multiple users and list them
  await client.call("createUser", { name: "User A", email: "a@test.com" });
  await client.call("createUser", { name: "User B", email: "b@test.com" });
  
  const listResult = await client.call("listUsers", { limit: 10, offset: 0 });
  
  expect(listResult.result).toBe("OK");
  expect(Array.isArray((listResult.data as any)?.users)).toBe(true);
  expect(typeof (listResult.data as any)?.total).toBe("number");
  expect(typeof (listResult.data as any)?.hasMore).toBe("boolean");
});

test("Server context integration test", async () => {
  const server = createTestServer();
  
  // Test that context generator is called with proper inputs
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token"
    },
    body: JSON.stringify({
      procedure: "authRequired",
      inputs: { action: "test" }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(201);
  expect(json.result).toBe("OK");
  expect(json.data.authorized).toBe(true);
  expect(json.data.user).toBe("test-token");
});