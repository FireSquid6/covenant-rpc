import { test, expect, mock } from "bun:test";
import { z } from "zod";
import { declareCovenant } from "../lib/index";
import { CovenantServer, type ProcedureInputs } from "../lib/server";
import { CovenantError } from "../lib/error";

// Test covenant schema
const testCovenant = declareCovenant({
  procedures: {
    getUser: {
      type: "query" as const,
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), name: z.string(), email: z.string() })
    },
    createUser: {
      type: "mutation" as const,
      input: z.object({ name: z.string(), email: z.string() }),
      output: z.object({ id: z.string(), success: z.boolean() })
    },
    noInputs: {
      type: "query" as const,
      input: z.object({}),
      output: z.object({ message: z.string() })
    },
    errorTest: {
      type: "mutation" as const,
      input: z.object({ shouldError: z.boolean() }),
      output: z.object({ result: z.string() })
    }
  },
  channels: {}
});

test("CovenantServer constructor should initialize properly", () => {
  const contextGenerator = mock(() => ({ userId: "test" }));
  const server = new CovenantServer(testCovenant, { contextGenerator });
  
  expect(server).toBeInstanceOf(CovenantServer);
});

test("defineProcedure should register procedure handlers", () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  const handler = mock(async ({ inputs }: ProcedureInputs<any, any>) => ({
    id: inputs.id,
    name: "Test User",
    email: "test@example.com"
  }));
  
  server.defineProcedure("getUser", handler);
  
  // Should not throw - procedure is defined
});

test("defineProcedure should throw when defining procedure twice", () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  const handler = mock(async () => ({ id: "1", name: "Test", email: "test@test.com" }));
  
  server.defineProcedure("getUser", handler);
  
  expect(() => server.defineProcedure("getUser", handler))
    .toThrow("Tried to define getUser twice!");
});

test("handleProcedure should process valid requests", async () => {
  const contextGenerator = mock(() => ({ userId: "context-user" }));
  const server = new CovenantServer(testCovenant, { contextGenerator });
  
  const handler = mock(async ({ inputs, ctx }: ProcedureInputs<any, any>) => ({
    id: inputs.id,
    name: "Alice",
    email: "alice@example.com"
  }));
  
  server.defineProcedure("getUser", handler);
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "getUser",
      inputs: { id: "user123" }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(201);
  expect(json.result).toBe("OK");
  expect(json.data).toEqual({
    id: "user123",
    name: "Alice",
    email: "alice@example.com"
  });
  expect(handler).toHaveBeenCalledTimes(1);
  expect(contextGenerator).toHaveBeenCalledTimes(1);
});

test("handleProcedure should return 404 for unknown procedure", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "unknownProcedure",
      inputs: {}
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(404);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toContain("Procedure unknownProcedure not found");
});

test("handleProcedure should return 400 for invalid input", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("getUser", mock(async () => ({
    id: "1", name: "Test", email: "test@test.com"
  })));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "getUser",
      inputs: { invalidField: "value" } // missing required 'id' field
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(400);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toContain("Error parsing procedure inputs");
});

test("handleProcedure should handle CovenantError from procedures", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("errorTest", mock(async ({ inputs }: ProcedureInputs<any, any>) => {
    if (inputs.shouldError) {
      throw new CovenantError("Custom procedure error", 422);
    }
    return { result: "success" };
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "errorTest",
      inputs: { shouldError: true }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(422);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toBe("Custom procedure error");
  expect(json.error.httpCode).toBe(422);
});

test("handleProcedure should handle regular Error from procedures", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("errorTest", mock(async () => {
    throw new Error("Regular error");
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "errorTest",
      inputs: { shouldError: false }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(500);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toBe("Regular error");
  expect(json.error.httpCode).toBe(500);
});

test("handleProcedure should handle unknown errors", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("errorTest", mock(async () => {
    throw "string error";
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "errorTest",
      inputs: { shouldError: false }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(500);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toContain("Unknown error: string error");
});

test("handleProcedure should provide procedure inputs with request context", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({ role: "admin" }) });
  
  const handler = mock(async ({ inputs, ctx, request }: ProcedureInputs<any, any>) => {
    expect(inputs).toEqual({ id: "user123" });
    expect(ctx).toEqual({ role: "admin" });
    expect(request.procedure).toBe("getUser");
    expect(request.headers).toBeInstanceOf(Headers);
    expect(request.url).toContain("localhost");
    expect(request.req).toBeInstanceOf(Request);
    
    return { id: inputs.id, name: "Test", email: "test@test.com" };
  });
  
  server.defineProcedure("getUser", handler);
  
  const request = new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer token123"
    },
    body: JSON.stringify({
      procedure: "getUser",
      inputs: { id: "user123" }
    })
  });
  
  await server.handleProcedure(request);
  
  expect(handler).toHaveBeenCalledTimes(1);
});

test("handleProcedure should allow header manipulation", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("getUser", mock(async ({ inputs, setHeader, deleteHeader }: ProcedureInputs<any, any>) => {
    setHeader("X-Custom-Header", "custom-value");
    setHeader("X-User-Id", inputs.id);
    deleteHeader("X-Unwanted");
    
    return { id: inputs.id, name: "Test", email: "test@test.com" };
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Unwanted": "remove-me"
    },
    body: JSON.stringify({
      procedure: "getUser",
      inputs: { id: "user456" }
    })
  });
  
  const response = await server.handleProcedure(request);
  
  expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
  expect(response.headers.get("X-User-Id")).toBe("user456");
  expect(response.headers.has("X-Unwanted")).toBe(false);
});

test("handleProcedure should provide error helper", async () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  server.defineProcedure("errorTest", mock(async ({ inputs, error }: ProcedureInputs<any, any>) => {
    if (inputs.shouldError) {
      error("Custom error using helper", 418);
    }
    return { result: "success" };
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "errorTest",
      inputs: { shouldError: true }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(418);
  expect(json.result).toBe("ERROR");
  expect(json.error.message).toBe("Custom error using helper");
  expect(json.error.httpCode).toBe(418);
});

test("handleProcedure should handle async context generator", async () => {
  const asyncContextGenerator = mock(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { asyncContext: true, timestamp: Date.now() };
  });
  
  const server = new CovenantServer(testCovenant, { contextGenerator: asyncContextGenerator });
  
  server.defineProcedure("getUser", mock(async ({ ctx }: ProcedureInputs<any, any>) => {
    expect(ctx.asyncContext).toBe(true);
    expect(typeof ctx.timestamp).toBe("number");
    
    return { id: "1", name: "Test", email: "test@test.com" };
  }));
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      procedure: "getUser",
      inputs: { id: "user123" }
    })
  });
  
  const response = await server.handleProcedure(request);
  const json = await response.json() as any;
  
  expect(response.status).toBe(201);
  expect(json.result).toBe("OK");
  expect(asyncContextGenerator).toHaveBeenCalledTimes(1);
});

test("server should be extensible", () => {
  const server = new CovenantServer(testCovenant, { contextGenerator: () => ({}) });
  
  // Test that assertAllDefined works
  expect(() => server.assertAllDefined()).toThrow("getUser was not defined");
});