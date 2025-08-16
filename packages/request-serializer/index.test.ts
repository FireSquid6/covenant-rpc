import { test, expect } from "bun:test";
import { serializeRequest, deserializeRequest, serializedRequestSchema, type SerializedRequest } from "./index";

test("serialize and deserialize GET request without body", async () => {
  const originalRequest = new Request("https://example.com/api/users", {
    method: "GET",
    headers: {
      "Authorization": "Bearer token123",
      "Content-Type": "application/json"
    }
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.url).toBe("https://example.com/api/users");
  expect(serialized.method).toBe("GET");
  expect(serialized.headers["authorization"]).toBe("Bearer token123");
  expect(serialized.headers["content-type"]).toBe("application/json");
  expect(serialized.body).toBeUndefined();
  expect(serialized.bodyType).toBeUndefined();

  expect(deserialized.url).toBe(originalRequest.url);
  expect(deserialized.method).toBe(originalRequest.method);
  expect(deserialized.headers.get("Authorization")).toBe("Bearer token123");
  expect(deserialized.headers.get("Content-Type")).toBe("application/json");
});

test("serialize and deserialize POST request with JSON body", async () => {
  const jsonData = { name: "John", age: 30 };
  const originalRequest = new Request("https://example.com/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jsonData)
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.method).toBe("POST");
  expect(serialized.body).toBe(JSON.stringify(jsonData));
  expect(serialized.bodyType).toBe("json");

  const deserializedBody = await deserialized.text();
  expect(JSON.parse(deserializedBody)).toEqual(jsonData);
});

test("serialize and deserialize POST request with form data", async () => {
  const formData = "name=John&age=30";
  const originalRequest = new Request("https://example.com/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.body).toBe(formData);
  expect(serialized.bodyType).toBe("formdata");

  const deserializedBody = await deserialized.text();
  expect(deserializedBody).toBe(formData);
});

test("serialize and deserialize request with binary data", async () => {
  const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
  const originalRequest = new Request("https://example.com/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream"
    },
    body: binaryData
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.bodyType).toBe("arraybuffer");
  expect(serialized.body).toBe(btoa(String.fromCharCode(...binaryData)));

  const deserializedBuffer = await deserialized.arrayBuffer();
  const deserializedArray = new Uint8Array(deserializedBuffer);
  expect(deserializedArray).toEqual(binaryData);
});

test("serialize and deserialize request with text body", async () => {
  const textData = "Hello, world!";
  const originalRequest = new Request("https://example.com/api/message", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain"
    },
    body: textData
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.body).toBe(textData);
  expect(serialized.bodyType).toBe("text");

  const deserializedBody = await deserialized.text();
  expect(deserializedBody).toBe(textData);
});

test("handle request with no content-type header", async () => {
  const textData = "Raw data";
  const originalRequest = new Request("https://example.com/api/raw", {
    method: "POST",
    body: textData
  });

  const serialized = await serializeRequest(originalRequest);
  const deserialized = deserializeRequest(serialized);

  expect(serialized.body).toBe(textData);
  expect(serialized.bodyType).toBe("text");

  const deserializedBody = await deserialized.text();
  expect(deserializedBody).toBe(textData);
});

test("roundtrip serialization preserves all request properties", async () => {
  const originalRequest = new Request("https://example.com/api/complex?param=value", {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer abc123",
      "X-Custom-Header": "custom-value",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ update: "data" })
  });

  const serialized = await serializeRequest(originalRequest);
  const json = JSON.stringify(serialized);
  const parsed: SerializedRequest = JSON.parse(json);
  const deserialized = deserializeRequest(parsed);

  expect(deserialized.url).toBe(originalRequest.url);
  expect(deserialized.method).toBe(originalRequest.method);
  expect(deserialized.headers.get("Authorization")).toBe("Bearer abc123");
  expect(deserialized.headers.get("X-Custom-Header")).toBe("custom-value");
  expect(deserialized.headers.get("Content-Type")).toBe("application/json");

  const originalBody = await originalRequest.text();
  const deserializedBody = await deserialized.text();
  expect(deserializedBody).toBe(originalBody);
});

test("zod schema validation works correctly", () => {
  const validData = {
    url: "https://example.com",
    method: "GET",
    headers: { "content-type": "application/json" },
    body: "test",
    bodyType: "text" as const
  };

  const result = serializedRequestSchema.safeParse(validData);
  expect(result.success).toBe(true);

  const invalidData = {
    url: "https://example.com",
    method: "GET",
    headers: { "content-type": "application/json" },
    bodyType: "invalid-type"
  };

  const invalidResult = serializedRequestSchema.safeParse(invalidData);
  expect(invalidResult.success).toBe(false);
});

test("deserializeRequest validates input with zod", () => {
  const invalidData = {
    url: "https://example.com",
    method: "GET",
    headers: { "content-type": "application/json" },
    bodyType: "invalid-type"
  };

  expect(() => deserializeRequest(invalidData as any)).toThrow();
});
