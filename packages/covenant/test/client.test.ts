import { test, expect, mock } from "bun:test";
import { z } from "zod";
import { declareCovenant, query, mutation } from "../lib/index";
import { CovenantClient, httpMessenger, directMessenger, type ClientMessenger } from "../lib/client";
import { CovenantServer } from "../lib/server";
import type { ProcedureRequest } from "../lib/request";

// Test covenant schema
const testCovenant = declareCovenant({
  procedures: {
    getUser: query({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), name: z.string() }),
      resources: () => []
    }),
    createUser: mutation({
      input: z.object({ name: z.string(), email: z.string() }),
      output: z.object({ id: z.string(), created: z.boolean() }),
      resources: () => []
    }),
    deleteUser: mutation({
      input: z.object({ id: z.string() }),
      output: z.object({ deleted: z.boolean() }),
      resources: () => []
    })
  },
  channels: {}
});

test("CovenantClient constructor should store covenant and messenger", () => {
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(new Response()))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  
  expect(client).toBeInstanceOf(CovenantClient);
});

test("CovenantClient.call should make successful procedure call", async () => {
  const mockResponse = {
    result: "OK" as const,
    error: undefined,
    data: { id: "user1", name: "Alice" }
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(mockResponse, { status: 201 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  const result = await client.call("getUser", { id: "user1" });
  
  expect(mockMessenger.fetch).toHaveBeenCalledTimes(1);
  expect(result).toEqual(mockResponse);
});

test("CovenantClient.call should handle error responses", async () => {
  const mockErrorResponse = {
    result: "ERROR" as const,
    error: { message: "User not found", httpCode: 404 },
    data: undefined
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(mockErrorResponse, { status: 404 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  const result = await client.call("getUser", { id: "nonexistent" });
  
  expect(result.result).toBe("ERROR");
  expect(result.error).toEqual({ message: "User not found", httpCode: 404 });
  expect(result.data).toBeUndefined();
});

test("CovenantClient.call should handle validation failures", async () => {
  const invalidResponse = {
    result: "OK",
    error: undefined,
    data: "invalid data type" // should be object
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(invalidResponse, { status: 201 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  const result = await client.call("getUser", { id: "user1" });
  
  expect(result.result).toBe("ERROR");
  expect(result.error?.message).toContain("Output validation failed");
  expect(result.data).toBeUndefined();
});

test("CovenantClient.call should send correct request format", async () => {
  const mockMessenger: ClientMessenger = {
    fetch: mock((request: ProcedureRequest) => {
      expect(request.procedure).toBe("createUser");
      expect(request.inputs).toEqual({ name: "Bob", email: "bob@test.com" });
      
      return Promise.resolve(Response.json({
        result: "OK",
        error: undefined,
        data: { id: "user2", created: true }
      }));
    })
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  await client.call("createUser", { name: "Bob", email: "bob@test.com" });
  
  expect(mockMessenger.fetch).toHaveBeenCalledTimes(1);
});

test("CovenantClient.callUnwrap should return data on success", async () => {
  const mockResponse = {
    result: "OK" as const,
    error: undefined,
    data: { id: "user1", name: "Alice" }
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(mockResponse, { status: 201 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  const result = await client.callUnwrap("getUser", { id: "user1" });
  
  expect(result).toEqual({ id: "user1", name: "Alice" });
});

test("CovenantClient.callUnwrap should throw on error by default", async () => {
  const mockErrorResponse = {
    result: "ERROR" as const,
    error: { message: "User not found", httpCode: 404 },
    data: undefined
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(mockErrorResponse, { status: 404 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  
  await expect(client.callUnwrap("getUser", { id: "nonexistent" }))
    .rejects.toThrow("Unwrapped an error calling getUser (404): User not found");
});

test("CovenantClient.callUnwrap should use custom thrower", async () => {
  const mockErrorResponse = {
    result: "ERROR" as const,
    error: { message: "Custom error", httpCode: 400 },
    data: undefined
  };
  
  const mockMessenger: ClientMessenger = {
    fetch: mock(() => Promise.resolve(Response.json(mockErrorResponse, { status: 400 })))
  };
  
  const client = new CovenantClient(testCovenant, mockMessenger);
  const customThrower = mock((error) => {
    throw new Error(`Custom: ${error.message}`);
  });
  
  await expect(client.callUnwrap("getUser", { id: "user1" }, customThrower))
    .rejects.toThrow("Custom: Custom error");
  
  expect(customThrower).toHaveBeenCalledWith({ message: "Custom error", httpCode: 400 });
});

test("httpMessenger should make HTTP requests", async () => {
  const httpUrl = "http://localhost:3000/api";
  const messenger = httpMessenger({ httpUrl });
  
  // Mock fetch globally
  const originalFetch = globalThis.fetch;
  const mockFetch = mock(() => Promise.resolve(Response.json({ result: "OK" })));
  globalThis.fetch = mockFetch as any;
  
  try {
    const request: ProcedureRequest = {
      procedure: "test",
      inputs: { data: "test" }
    };
    
    await messenger.fetch(request);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(httpUrl),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      })
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("directMessenger should call server directly", async () => {
  const mockServer = {
    handleProcedure: mock((req: Request) => Promise.resolve(Response.json({ result: "OK" })))
  } as any;
  
  const messenger = directMessenger(mockServer);
  const request: ProcedureRequest = {
    procedure: "test",
    inputs: { data: "test" }
  };
  
  await messenger.fetch(request);
  
  expect(mockServer.handleProcedure).toHaveBeenCalledTimes(1);
  const calledRequest = mockServer.handleProcedure.mock.calls[0][0];
  expect(calledRequest).toBeInstanceOf(Request);
  expect(calledRequest.method).toBe("POST");
  expect(calledRequest.headers.get("Content-Type")).toBe("application/json");
});

test("directMessenger should create proper Request object", async () => {
  const mockServer = {
    handleProcedure: mock(async (req: Request) => {
      expect(req.url).toBe("http://localhost:3000/");
      expect(req.method).toBe("POST");
      expect(req.headers.get("Content-Type")).toBe("application/json");
      
      const body = await req.json();
      expect(body).toEqual({
        procedure: "testProcedure",
        inputs: { id: "123", name: "test" }
      });
      
      return Response.json({ result: "OK" });
    })
  } as any;
  
  const messenger = directMessenger(mockServer);
  const request: ProcedureRequest = {
    procedure: "testProcedure",
    inputs: { id: "123", name: "test" }
  };
  
  await messenger.fetch(request);
  
  expect(mockServer.handleProcedure).toHaveBeenCalledTimes(1);
});