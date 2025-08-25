import { test, expect } from "bun:test";
import { v } from "../validation";

test("bool validator", () => {
  const validator = v.bool();
  expect(validator(true)).toBe(true);
  expect(validator(false)).toBe(true);
  expect(validator("true")).toBe(false);
  expect(validator(1)).toBe(false);
  expect(validator(null)).toBe(false);
});

test("number validator", () => {
  const validator = v.number();
  expect(validator(42)).toBe(true);
  expect(validator(3.14)).toBe(true);
  expect(validator("42")).toBe(false);
  expect(validator(true)).toBe(false);
  expect(validator(null)).toBe(false);
});

test("string validator", () => {
  const validator = v.string();
  expect(validator("hello")).toBe(true);
  expect(validator("")).toBe(true);
  expect(validator(42)).toBe(false);
  expect(validator(null)).toBe(false);
});

test("optional validator", () => {
  const validator = v.optional(v.string());
  expect(validator("hello")).toBe(true);
  expect(validator(undefined)).toBe(true);
  expect(validator(null)).toBe(false);
  expect(validator(42)).toBe(false);
});

test("nullable validator", () => {
  const validator = v.nullable(v.string());
  expect(validator("hello")).toBe(true);
  expect(validator(null)).toBe(true);
  expect(validator(undefined)).toBe(false);
  expect(validator(42)).toBe(false);
});

test("union validator", () => {
  const validator = v.union(v.string(), v.number());
  expect(validator("hello")).toBe(true);
  expect(validator(42)).toBe(true);
  expect(validator(true)).toBe(false);
  expect(validator(null)).toBe(false);
});

test("literal validator", () => {
  const stringLiteral = v.literal("success");
  expect(stringLiteral("success")).toBe(true);
  expect(stringLiteral("fail")).toBe(false);
  expect(stringLiteral(null)).toBe(false);

  const numberLiteral = v.literal(42);
  expect(numberLiteral(42)).toBe(true);
  expect(numberLiteral(43)).toBe(false);

  const boolLiteral = v.literal(true);
  expect(boolLiteral(true)).toBe(true);
  expect(boolLiteral(false)).toBe(false);

  const nullLiteral = v.literal(null);
  expect(nullLiteral(null)).toBe(true);
  expect(nullLiteral(undefined)).toBe(false);
});

test("obj validator", () => {
  const validator = v.obj({
    name: v.string(),
    age: v.number(),
    active: v.bool()
  });

  expect(validator({
    name: "John",
    age: 30,
    active: true
  })).toBe(true);

  expect(validator({
    name: "John",
    age: "30",
    active: true
  })).toBe(false);

  expect(validator({
    name: "John",
    age: 30
  })).toBe(false);

  expect(validator(null)).toBe(false);
  expect(validator("not an object")).toBe(false);
});

test("complex nested validation", () => {
  const validator = v.obj({
    status: v.union(v.literal("success"), v.literal("error")),
    data: v.optional(v.obj({
      id: v.number(),
      name: v.string()
    })),
    metadata: v.nullable(v.obj({
      timestamp: v.number()
    }))
  });

  expect(validator({
    status: "success",
    data: { id: 1, name: "test" },
    metadata: { timestamp: 123456 }
  })).toBe(true);

  expect(validator({
    status: "error",
    data: undefined,
    metadata: null
  })).toBe(true);

  expect(validator({
    status: "pending",
    data: undefined,
    metadata: null
  })).toBe(false);
});

test("array validator", () => {
  const stringArrayValidator = v.array(v.string());
  expect(stringArrayValidator(["hello", "world"])).toBe(true);
  expect(stringArrayValidator([])).toBe(true);
  expect(stringArrayValidator(["hello", 42])).toBe(false);
  expect(stringArrayValidator("not an array")).toBe(false);
  expect(stringArrayValidator(null)).toBe(false);

  const numberArrayValidator = v.array(v.number());
  expect(numberArrayValidator([1, 2, 3])).toBe(true);
  expect(numberArrayValidator([1, "2", 3])).toBe(false);
});

test("tuple validator", () => {
  const tupleValidator = v.tuple(v.string(), v.number(), v.bool());
  expect(tupleValidator(["hello", 42, true])).toBe(true);
  expect(tupleValidator(["hello", 42, false])).toBe(true);
  expect(tupleValidator(["hello", 42])).toBe(false);
  expect(tupleValidator(["hello", 42, true, "extra"])).toBe(false);
  expect(tupleValidator([42, "hello", true])).toBe(false);
  expect(tupleValidator("not an array")).toBe(false);

  const emptyTuple = v.tuple();
  expect(emptyTuple([])).toBe(true);
  expect(emptyTuple([1])).toBe(false);
});

test("record validator", () => {
  const recordValidator = v.record(v.string(), v.number());
  expect(recordValidator({ a: 1, b: 2 })).toBe(true);
  expect(recordValidator({})).toBe(true);
  expect(recordValidator({ a: 1, b: "not a number" })).toBe(false);
  expect(recordValidator("not an object")).toBe(false);
  expect(recordValidator(null)).toBe(false);

  const literalKeyRecord = v.record(v.union(v.literal("id"), v.literal("name")), v.string());
  expect(literalKeyRecord({ id: "123", name: "test" })).toBe(true);
  expect(literalKeyRecord({ id: "123", age: "test" })).toBe(false);
});

test("instanceOf validator", () => {
  class TestClass {
    constructor(public value: string) {}
  }

  const instanceValidator = v.instanceOf(TestClass);
  const instance = new TestClass("test");
  expect(instanceValidator(instance)).toBe(true);
  expect(instanceValidator({})).toBe(false);
  expect(instanceValidator("not an instance")).toBe(false);
  expect(instanceValidator(null)).toBe(false);

  const dateValidator = v.instanceOf(Date);
  expect(dateValidator(new Date())).toBe(true);
  expect(dateValidator("2023-01-01")).toBe(false);
});

test("custom validator", () => {
  const positiveNumberValidator = v.custom((value): value is number => {
    return typeof value === "number" && value > 0;
  });

  expect(positiveNumberValidator(5)).toBe(true);
  expect(positiveNumberValidator(0)).toBe(false);
  expect(positiveNumberValidator(-5)).toBe(false);
  expect(positiveNumberValidator("5")).toBe(false);

  const emailValidator = v.custom((value): value is string => {
    return typeof value === "string" && value.includes("@");
  });

  expect(emailValidator("user@example.com")).toBe(true);
  expect(emailValidator("not-an-email")).toBe(false);
  expect(emailValidator(123)).toBe(false);
});
