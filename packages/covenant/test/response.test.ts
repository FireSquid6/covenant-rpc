import { test, expect } from "bun:test";
import { z } from "zod";
import { 
  getResponseSchema, 
  procedureResponseToJs, 
  procedureErrorSchema, 
  type ProcedureError,
  type ProcedureResponse 
} from "../lib/response";

test("procedureErrorSchema should validate error objects", () => {
  const validError = {
    message: "Something went wrong",
    httpCode: 500
  };
  
  const result = procedureErrorSchema.safeParse(validError);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data).toEqual(validError);
  }
});

test("procedureErrorSchema should reject invalid errors", () => {
  const invalidErrors = [
    { message: "error" }, // missing httpCode
    { httpCode: 400 }, // missing message
    { message: 123, httpCode: 400 }, // wrong message type
    { message: "error", httpCode: "400" }, // wrong httpCode type
    {}
  ];
  
  invalidErrors.forEach(error => {
    const result = procedureErrorSchema.safeParse(error);
    expect(result.success).toBe(false);
  });
});

test("getResponseSchema should create schema for OK responses", () => {
  const outputSchema = z.object({ name: z.string() });
  const responseSchema = getResponseSchema(outputSchema);
  
  const validOkResponse = {
    result: "OK" as const,
    error: undefined,
    data: { name: "test" }
  };
  
  const result = responseSchema.safeParse(validOkResponse);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data).toEqual(validOkResponse);
  }
});

test("getResponseSchema should create schema for ERROR responses", () => {
  const outputSchema = z.object({ name: z.string() });
  const responseSchema = getResponseSchema(outputSchema);
  
  const validErrorResponse = {
    result: "ERROR" as const,
    error: { message: "Not found", httpCode: 404 },
    data: undefined
  };
  
  const result = responseSchema.safeParse(validErrorResponse);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data).toEqual(validErrorResponse);
  }
});

test("getResponseSchema should reject mixed OK/ERROR responses", () => {
  const outputSchema = z.object({ name: z.string() });
  const responseSchema = getResponseSchema(outputSchema);
  
  const invalidResponses = [
    {
      result: "OK",
      error: { message: "error", httpCode: 400 }, // OK with error
      data: { name: "test" }
    },
    {
      result: "ERROR", 
      error: undefined, // ERROR without error
      data: { name: "test" }
    },
    {
      result: "OK",
      error: undefined,
      data: undefined // OK without data
    }
  ];
  
  invalidResponses.forEach(response => {
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});

test("getResponseSchema should validate data against output schema", () => {
  const outputSchema = z.object({ 
    id: z.number(),
    name: z.string(),
    active: z.boolean()
  });
  const responseSchema = getResponseSchema(outputSchema);
  
  const validResponse = {
    result: "OK" as const,
    error: undefined,
    data: { id: 1, name: "test", active: true }
  };
  
  const invalidResponse = {
    result: "OK" as const,
    error: undefined,
    data: { id: "not-number", name: "test", active: true }
  };
  
  expect(responseSchema.safeParse(validResponse).success).toBe(true);
  expect(responseSchema.safeParse(invalidResponse).success).toBe(false);
});

test("procedureResponseToJs should create Response for OK result", () => {
  const okResponse: ProcedureResponse<z.ZodString> = {
    result: "OK",
    error: undefined,
    data: "success"
  };
  
  const headers = new Headers();
  const response = procedureResponseToJs(okResponse, headers);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
});

test("procedureResponseToJs should create Response for ERROR result", () => {
  const errorResponse: ProcedureResponse<z.ZodString> = {
    result: "ERROR",
    error: { message: "Not found", httpCode: 404 },
    data: undefined
  };
  
  const headers = new Headers();
  const response = procedureResponseToJs(errorResponse, headers);
  
  expect(response.status).toBe(404);
  expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
});

test("procedureResponseToJs should preserve custom headers", () => {
  const okResponse: ProcedureResponse<z.ZodString> = {
    result: "OK",
    error: undefined,
    data: "success"
  };
  
  const headers = new Headers({
    "X-Custom-Header": "custom-value",
    "Authorization": "Bearer token"
  });
  
  const response = procedureResponseToJs(okResponse, headers);
  
  expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
  expect(response.headers.get("Authorization")).toBe("Bearer token");
  expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
});

test("procedureResponseToJs should handle various HTTP error codes", () => {
  const errorCodes = [400, 401, 403, 404, 422, 500, 502, 503];
  
  errorCodes.forEach(code => {
    const errorResponse: ProcedureResponse<z.ZodString> = {
      result: "ERROR",
      error: { message: `Error ${code}`, httpCode: code },
      data: undefined
    };
    
    const headers = new Headers();
    const response = procedureResponseToJs(errorResponse, headers);
    
    expect(response.status).toBe(code);
  });
});

test("procedureResponseToJs response body should be JSON serializable", async () => {
  const okResponse: ProcedureResponse<z.ZodObject<{ id: z.ZodNumber, name: z.ZodString }>> = {
    result: "OK",
    error: undefined,
    data: { id: 123, name: "test user" }
  };
  
  const headers = new Headers();
  const response = procedureResponseToJs(okResponse, headers);
  
  const json = await response.json();
  expect(json).toEqual(okResponse);
});

test("procedureResponseToJs should handle complex data structures", () => {
  const complexResponse: ProcedureResponse<z.ZodAny> = {
    result: "OK",
    error: undefined,
    data: {
      users: [
        { id: 1, name: "Alice", tags: ["admin", "user"] },
        { id: 2, name: "Bob", tags: ["user"] }
      ],
      meta: {
        total: 2,
        page: 1,
        hasNext: false
      }
    }
  };
  
  const headers = new Headers();
  const response = procedureResponseToJs(complexResponse, headers);
  
  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/json;charset=utf-8");
});