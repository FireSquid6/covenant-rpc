import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { type } from "arktype";
import { getAnnotation } from "./index";

describe("getAnnotation", () => {
  describe("Zod", () => {
    test("flat object with basic types", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });
      const result = getAnnotation(schema, {
        name: "The user's full name",
        age: "Age in years",
        active: "Whether the account is active",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "The user's full name" },
        age: { typeName: "number", description: "Age in years" },
        active: { typeName: "boolean", description: "Whether the account is active" },
      });
    });

    test("nested object", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
        active: z.boolean(),
      });
      const result = getAnnotation(schema, {
        user: {
          name: "The user's full name",
          age: "Age in years",
        },
        active: "Whether the account is active",
      });
      expect(result).toEqual({
        "user.name": { typeName: "string", description: "The user's full name" },
        "user.age": { typeName: "number", description: "Age in years" },
        active: { typeName: "boolean", description: "Whether the account is active" },
      });
    });

    test("deeply nested object", () => {
      const schema = z.object({
        org: z.object({
          address: z.object({
            city: z.string(),
            zip: z.string(),
          }),
        }),
      });
      const result = getAnnotation(schema, {
        org: {
          address: {
            city: "City name",
            zip: "Postal code",
          },
        },
      });
      expect(result).toEqual({
        "org.address.city": { typeName: "string", description: "City name" },
        "org.address.zip": { typeName: "string", description: "Postal code" },
      });
    });

    test("partial annotator (only some fields annotated)", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });
      const result = getAnnotation(schema, {
        name: "The user's full name",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "The user's full name" },
      });
    });

    test("optional field annotated correctly", () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });
      const result = getAnnotation(schema, {
        name: "Full name",
        nickname: "Optional display name",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "Full name" },
        nickname: { typeName: "string", description: "Optional display name" },
      });
    });

    test("array field annotated with array type", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const result = getAnnotation(schema, {
        tags: "List of tags",
      });
      expect(result).toEqual({
        tags: { typeName: "array", description: "List of tags" },
      });
    });

    test("field not in schema gets unknown typeName", () => {
      const schema = z.object({
        name: z.string(),
      });
      const result = getAnnotation(schema, {
        name: "Name",
        nonexistent: "This field does not exist",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "Name" },
        nonexistent: { typeName: "unknown", description: "This field does not exist" },
      });
    });

    test("empty annotator returns empty result", () => {
      const schema = z.object({ name: z.string() });
      const result = getAnnotation(schema, {});
      expect(result).toEqual({});
    });
  });

  describe("ArkType", () => {
    test("flat object with basic types", () => {
      const schema = type({ name: "string", age: "number", active: "boolean" });
      const result = getAnnotation(schema, {
        name: "The user's full name",
        age: "Age in years",
        active: "Whether the account is active",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "The user's full name" },
        age: { typeName: "number", description: "Age in years" },
        active: { typeName: "boolean", description: "Whether the account is active" },
      });
    });

    test("nested object", () => {
      const schema = type({
        user: { name: "string", age: "number" },
        active: "boolean",
      });
      const result = getAnnotation(schema, {
        user: {
          name: "The user's full name",
          age: "Age in years",
        },
        active: "Whether the account is active",
      });
      expect(result).toEqual({
        "user.name": { typeName: "string", description: "The user's full name" },
        "user.age": { typeName: "number", description: "Age in years" },
        active: { typeName: "boolean", description: "Whether the account is active" },
      });
    });

    test("partial annotator (only some fields annotated)", () => {
      const schema = type({ name: "string", age: "number" });
      const result = getAnnotation(schema, {
        name: "The user's full name",
      });
      expect(result).toEqual({
        name: { typeName: "string", description: "The user's full name" },
      });
    });

    test("empty annotator returns empty result", () => {
      const schema = type({ name: "string" });
      const result = getAnnotation(schema, {});
      expect(result).toEqual({});
    });
  });
});
