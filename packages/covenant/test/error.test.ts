import { test, expect } from "bun:test";
import { CovenantError } from "../lib/error";

test("CovenantError constructor should set message and httpCode", () => {
  const error = new CovenantError("Test error", 400);
  
  expect(error.message).toBe("Test error");
  expect(error.httpCode).toBe(400);
});

test("CovenantError.fromError should create CovenantError from Error", () => {
  const originalError = new Error("Original error message");
  const covenantError = CovenantError.fromError(originalError);
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe("Original error message");
  expect(covenantError.httpCode).toBe(500);
});

test("CovenantError.fromUnknown should handle string input", () => {
  const covenantError = CovenantError.fromUnknown("string error");
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe("Unknown error: string error");
  expect(covenantError.httpCode).toBe(500);
});

test("CovenantError.fromUnknown should handle number input", () => {
  const covenantError = CovenantError.fromUnknown(404);
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe("Unknown error: 404");
  expect(covenantError.httpCode).toBe(500);
});

test("CovenantError.fromUnknown should handle object input", () => {
  const obj = { type: "custom", code: 123 };
  const covenantError = CovenantError.fromUnknown(obj);
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe(`Unknown error: ${obj}`);
  expect(covenantError.httpCode).toBe(500);
});

test("CovenantError.fromUnknown should handle null input", () => {
  const covenantError = CovenantError.fromUnknown(null);
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe("Unknown error: null");
  expect(covenantError.httpCode).toBe(500);
});

test("CovenantError.fromUnknown should handle undefined input", () => {
  const covenantError = CovenantError.fromUnknown(undefined);
  
  expect(covenantError).toBeInstanceOf(CovenantError);
  expect(covenantError.message).toBe("Unknown error: undefined");
  expect(covenantError.httpCode).toBe(500);
});

test("toProcedureError should return correct ProcedureError object", () => {
  const error = new CovenantError("Validation failed", 400);
  const procedureError = error.toProcedureError();
  
  expect(procedureError).toEqual({
    message: "Validation failed",
    httpCode: 400
  });
});

test("toProcedureError should maintain different httpCodes", () => {
  const error404 = new CovenantError("Not found", 404);
  const error500 = new CovenantError("Server error", 500);
  
  expect(error404.toProcedureError().httpCode).toBe(404);
  expect(error500.toProcedureError().httpCode).toBe(500);
});

test("CovenantError should work with various HTTP status codes", () => {
  const testCases = [
    { message: "Bad request", code: 400 },
    { message: "Unauthorized", code: 401 },
    { message: "Forbidden", code: 403 },
    { message: "Not found", code: 404 },
    { message: "Method not allowed", code: 405 },
    { message: "Internal server error", code: 500 },
    { message: "Bad gateway", code: 502 },
    { message: "Service unavailable", code: 503 }
  ];
  
  testCases.forEach(({ message, code }) => {
    const error = new CovenantError(message, code);
    expect(error.message).toBe(message);
    expect(error.httpCode).toBe(code);
    expect(error.toProcedureError()).toEqual({ message, httpCode: code });
  });
});