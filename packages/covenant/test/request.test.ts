import { test, expect } from "bun:test";
import { parseRequest, procedureRequestSchema, type ProcedureRequest } from "../lib/request";
import { CovenantError } from "../lib/error";

test("procedureRequestSchema should validate valid requests", () => {
  const validRequest = {
    procedure: "getUser",
    inputs: { id: "123" }
  };
  
  const result = procedureRequestSchema.safeParse(validRequest);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data).toEqual(validRequest);
  }
});

test("procedureRequestSchema should accept any inputs", () => {
  const requests = [
    { procedure: "test", inputs: { id: "123", name: "test" } },
    { procedure: "test", inputs: "string input" },
    { procedure: "test", inputs: 123 },
    { procedure: "test", inputs: null },
    { procedure: "test", inputs: undefined },
    { procedure: "test", inputs: [] },
    { procedure: "test", inputs: { nested: { deep: true } } }
  ];
  
  requests.forEach(request => {
    const result = procedureRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });
});

test("procedureRequestSchema should reject missing procedure", () => {
  const invalidRequest = {
    inputs: { id: "123" }
  };
  
  const result = procedureRequestSchema.safeParse(invalidRequest);
  expect(result.success).toBe(false);
});

test("procedureRequestSchema should accept missing inputs (z.any allows undefined)", () => {
  const requestWithoutInputs = {
    procedure: "getUser"
  };
  
  const result = procedureRequestSchema.safeParse(requestWithoutInputs);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.inputs).toBeUndefined();
  }
});

test("procedureRequestSchema should reject non-string procedure", () => {
  const invalidRequests = [
    { procedure: 123, inputs: {} },
    { procedure: null, inputs: {} },
    { procedure: undefined, inputs: {} },
    { procedure: {}, inputs: {} },
    { procedure: [], inputs: {} }
  ];
  
  invalidRequests.forEach(request => {
    const result = procedureRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });
});

test("parseRequest should parse valid JSON requests", async () => {
  const requestBody = {
    procedure: "findUser",
    inputs: { id: "user123" }
  };
  
  const request = new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  
  const parsed = await parseRequest(request);
  
  expect(parsed.procedure).toBe("findUser");
  expect(parsed.input).toEqual({ id: "user123" });
  expect(parsed.url).toBe("http://localhost:3000/api");
  expect(parsed.path).toBe("/api");
  expect(parsed.headers).toBe(request.headers);
  expect(parsed.req).toBe(request);
});

test("parseRequest should handle complex URLs", async () => {
  const request = new Request("http://example.com:8080/api/procedures?debug=true#section", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ procedure: "test", inputs: {} })
  });
  
  const parsed = await parseRequest(request);
  
  expect(parsed.url).toBe("http://example.com:8080/api/procedures?debug=true#section");
  expect(parsed.path).toBe("/api/procedures");
});

test("parseRequest should throw CovenantError for invalid JSON", async () => {
  const request = new Request("http://localhost:3000", {
    method: "POST",
    body: "invalid json"
  });
  
  await expect(parseRequest(request)).rejects.toThrow(CovenantError);
});

test("parseRequest should throw CovenantError for missing procedure", async () => {
  const request = new Request("http://localhost:3000", {
    method: "POST",
    body: JSON.stringify({ inputs: {} })
  });
  
  try {
    await parseRequest(request);
    expect(true).toBe(false); // Should not reach here
  } catch (error) {
    expect(error).toBeInstanceOf(CovenantError);
    expect((error as CovenantError).httpCode).toBe(400);
    expect((error as CovenantError).message).toContain("Didn't recieve expected schema");
  }
});

test("parseRequest should handle missing inputs gracefully", async () => {
  const request = new Request("http://localhost:3000", {
    method: "POST",
    body: JSON.stringify({ procedure: "test" })
  });
  
  const parsed = await parseRequest(request);
  
  expect(parsed.procedure).toBe("test");
  expect(parsed.input).toBeUndefined();
});

test("parseRequest should preserve request headers", async () => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Authorization": "Bearer token123",
    "User-Agent": "test-client"
  });
  
  const request = new Request("http://localhost:3000", {
    method: "POST",
    headers,
    body: JSON.stringify({ procedure: "auth", inputs: { token: "123" } })
  });
  
  const parsed = await parseRequest(request);
  
  expect(parsed.headers.get("Content-Type")).toBe("application/json");
  expect(parsed.headers.get("Authorization")).toBe("Bearer token123");
  expect(parsed.headers.get("User-Agent")).toBe("test-client");
});

test("parseRequest should handle empty inputs object", async () => {
  const request = new Request("http://localhost:3000", {
    method: "POST",
    body: JSON.stringify({ procedure: "noInputs", inputs: {} })
  });
  
  const parsed = await parseRequest(request);
  
  expect(parsed.procedure).toBe("noInputs");
  expect(parsed.input).toEqual({});
});