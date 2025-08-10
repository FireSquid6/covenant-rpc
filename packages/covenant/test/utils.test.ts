import { test, expect } from "bun:test";
import type { MaybePromise, Flatten } from "../lib/utils";

test("MaybePromise type should accept Promise", () => {
  // This test verifies the type works correctly at compile time
  const promiseValue: MaybePromise<string> = Promise.resolve("test");
  
  expect(promiseValue).toBeInstanceOf(Promise);
});

test("MaybePromise type should accept direct value", () => {
  // This test verifies the type works correctly at compile time
  const directValue: MaybePromise<string> = "test";
  
  expect(directValue).toBe("test");
});

test("MaybePromise should work with complex types", () => {
  type ComplexType = { id: number; name: string; tags: string[] };
  
  const promiseComplex: MaybePromise<ComplexType> = Promise.resolve({
    id: 1,
    name: "test",
    tags: ["a", "b"]
  });
  
  const directComplex: MaybePromise<ComplexType> = {
    id: 2,
    name: "direct",
    tags: ["x", "y"]
  };
  
  expect(promiseComplex).toBeInstanceOf(Promise);
  expect(directComplex.id).toBe(2);
  expect(directComplex.name).toBe("direct");
  expect(directComplex.tags).toEqual(["x", "y"]);
});

test("Flatten type should preserve object structure", () => {
  // This test verifies the type works correctly at compile time
  type TestObject = {
    id: string;
    name: string;
    count: number;
  };
  
  const original: TestObject = {
    id: "test",
    name: "Test Object",
    count: 42
  };
  
  // Flatten should preserve the type structure
  const flattened: Flatten<TestObject> = original;
  
  expect(flattened.id).toBe("test");
  expect(flattened.name).toBe("Test Object");
  expect(flattened.count).toBe(42);
});

test("Flatten type should work with nested objects", () => {
  type NestedObject = {
    user: {
      id: string;
      profile: {
        name: string;
        age: number;
      };
    };
    meta: {
      created: Date;
      updated: Date;
    };
  };
  
  const nested: NestedObject = {
    user: {
      id: "user1",
      profile: {
        name: "Alice",
        age: 30
      }
    },
    meta: {
      created: new Date("2023-01-01"),
      updated: new Date("2023-12-01")
    }
  };
  
  // Flatten should preserve nested structure
  const flattened: Flatten<NestedObject> = nested;
  
  expect(flattened.user.id).toBe("user1");
  expect(flattened.user.profile.name).toBe("Alice");
  expect(flattened.user.profile.age).toBe(30);
  expect(flattened.meta.created).toEqual(new Date("2023-01-01"));
  expect(flattened.meta.updated).toEqual(new Date("2023-12-01"));
});

test("Flatten type should work with optional properties", () => {
  type OptionalProps = {
    required: string;
    optional?: number;
    nullable: string | null;
    undefined?: undefined;
  };
  
  const withOptional: OptionalProps = {
    required: "test",
    optional: 42,
    nullable: "not null"
  };
  
  const withoutOptional: OptionalProps = {
    required: "test",
    nullable: null
  };
  
  const flattened1: Flatten<OptionalProps> = withOptional;
  const flattened2: Flatten<OptionalProps> = withoutOptional;
  
  expect(flattened1.required).toBe("test");
  expect(flattened1.optional).toBe(42);
  expect(flattened1.nullable).toBe("not null");
  
  expect(flattened2.required).toBe("test");
  expect(flattened2.optional).toBeUndefined();
  expect(flattened2.nullable).toBeNull();
});

test("Flatten type should work with arrays", () => {
  type ArrayProps = {
    strings: string[];
    numbers: number[];
    objects: { id: string; value: number }[];
  };
  
  const arrays: ArrayProps = {
    strings: ["a", "b", "c"],
    numbers: [1, 2, 3],
    objects: [
      { id: "obj1", value: 10 },
      { id: "obj2", value: 20 }
    ]
  };
  
  const flattened: Flatten<ArrayProps> = arrays;
  
  expect(flattened.strings).toEqual(["a", "b", "c"]);
  expect(flattened.numbers).toEqual([1, 2, 3]);
  expect(flattened.objects).toHaveLength(2);
  expect(flattened.objects[0]?.id).toBe("obj1");
  expect(flattened.objects[1]?.value).toBe(20);
});

test("Flatten type should work with union types", () => {
  type UnionProps = {
    stringOrNumber: string | number;
    optionalUnion?: boolean | string;
    nullableUnion: Date | null;
  };
  
  const unionObj1: UnionProps = {
    stringOrNumber: "string value",
    optionalUnion: true,
    nullableUnion: new Date("2023-01-01")
  };
  
  const unionObj2: UnionProps = {
    stringOrNumber: 42,
    optionalUnion: "string value",
    nullableUnion: null
  };
  
  const flattened1: Flatten<UnionProps> = unionObj1;
  const flattened2: Flatten<UnionProps> = unionObj2;
  
  expect(flattened1.stringOrNumber).toBe("string value");
  expect(flattened1.optionalUnion).toBe(true);
  expect(flattened1.nullableUnion).toBeInstanceOf(Date);
  
  expect(flattened2.stringOrNumber).toBe(42);
  expect(flattened2.optionalUnion).toBe("string value");
  expect(flattened2.nullableUnion).toBeNull();
});

test("Types should compose together", async () => {
  // Test that MaybePromise and Flatten work together
  type ComplexType = {
    data: {
      id: string;
      items: number[];
    };
    meta?: {
      count: number;
    };
  };
  
  const syncValue: MaybePromise<Flatten<ComplexType>> = {
    data: {
      id: "sync",
      items: [1, 2, 3]
    },
    meta: {
      count: 3
    }
  };
  
  const asyncValue: MaybePromise<Flatten<ComplexType>> = Promise.resolve({
    data: {
      id: "async",
      items: [4, 5, 6]
    }
  });
  
  expect(syncValue.data.id).toBe("sync");
  expect(syncValue.data.items).toEqual([1, 2, 3]);
  expect(syncValue.meta?.count).toBe(3);
  
  const resolvedAsync = await asyncValue;
  expect(resolvedAsync.data.id).toBe("async");
  expect(resolvedAsync.data.items).toEqual([4, 5, 6]);
  expect(resolvedAsync.meta).toBeUndefined();
});