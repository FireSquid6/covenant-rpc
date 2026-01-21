import { test } from "bun:test";
import { v } from "../lib/validation";

// Type-level testing helper
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

test("type inference works correctly", () => {
  // Basic type inference
  type BoolInfer = v.Infer<ReturnType<typeof v.bool>>;
  type NumberInfer = v.Infer<ReturnType<typeof v.number>>;
  type StringInfer = v.Infer<ReturnType<typeof v.string>>;

  type _BoolTest = Expect<Equal<BoolInfer, boolean>>;
  type _NumberTest = Expect<Equal<NumberInfer, number>>;
  type _StringTest = Expect<Equal<StringInfer, string>>;

  // Optional type inference
  type OptionalStringInfer = v.Infer<ReturnType<typeof v.optional<string>>>;
  type _OptionalTest = Expect<Equal<OptionalStringInfer, string | undefined>>;

  // Nullable type inference
  type NullableStringInfer = v.Infer<ReturnType<typeof v.nullable<string>>>;
  type _NullableTest = Expect<Equal<NullableStringInfer, string | null>>;

  // Union type inference
  const stringOrNumber = v.union(v.string(), v.number());
  type UnionInfer = v.Infer<typeof stringOrNumber>;
  type _UnionTest = Expect<Equal<UnionInfer, string | number>>;

  // Literal type inference
  const successLiteral = v.literal("success");
  const numberLiteral = v.literal(42);
  const boolLiteral = v.literal(true);
  const nullLiteral = v.literal(null);

  type SuccessLiteralInfer = v.Infer<typeof successLiteral>;
  type NumberLiteralInfer = v.Infer<typeof numberLiteral>;
  type BoolLiteralInfer = v.Infer<typeof boolLiteral>;
  type NullLiteralInfer = v.Infer<typeof nullLiteral>;

  type _SuccessLiteralTest = Expect<Equal<SuccessLiteralInfer, "success">>;
  type _NumberLiteralTest = Expect<Equal<NumberLiteralInfer, 42>>;
  type _BoolLiteralTest = Expect<Equal<BoolLiteralInfer, true>>;
  type _NullLiteralTest = Expect<Equal<NullLiteralInfer, null>>;

  // Object type inference
  const userValidator = v.obj({
    id: v.number(),
    name: v.string(),
    active: v.bool()
  });

  type UserInfer = v.Infer<typeof userValidator>;
  type ExpectedUser = {
    id: number;
    name: string;
    active: boolean;
  };
  type _UserTest = Expect<Equal<UserInfer, ExpectedUser>>;

  // Complex nested object with optional and nullable fields
  const complexValidator = v.obj({
    status: v.union(v.literal("success"), v.literal("error"), v.literal("pending")),
    data: v.optional(v.obj({
      id: v.number(),
      name: v.string(),
      tags: v.nullable(v.union(v.string(), v.number()))
    })),
    metadata: v.nullable(v.obj({
      timestamp: v.number(),
      source: v.literal("api")
    }))
  });

  type ComplexInfer = v.Infer<typeof complexValidator>;
  type ExpectedComplex = {
    status: "success" | "error" | "pending";
    data: {
      id: number;
      name: string;
      tags: string | number | null;
    } | undefined;
    metadata: {
      timestamp: number;
      source: "api";
    } | null;
  };
  type _ComplexTest = Expect<Equal<ComplexInfer, ExpectedComplex>>;

  // Multiple union literals
  const statusValidator = v.union(
    v.literal("loading"),
    v.literal("success"), 
    v.literal("error")
  );
  type StatusInfer = v.Infer<typeof statusValidator>;
  type _StatusTest = Expect<Equal<StatusInfer, "loading" | "success" | "error">>;

  // Mixed union types
  const mixedValidator = v.union(
    v.literal("none"),
    v.number(),
    v.obj({ type: v.literal("object") })
  );
  type MixedInfer = v.Infer<typeof mixedValidator>;
  type ExpectedMixed = "none" | number | { type: "object" };
  type _MixedTest = Expect<Equal<MixedInfer, ExpectedMixed>>;

  // Array type inference
  const stringArrayValidator = v.array(v.string());
  const numberArrayValidator = v.array(v.number());
  const objArrayValidator = v.array(v.obj({ id: v.number() }));
  
  type StringArrayInfer = v.Infer<typeof stringArrayValidator>;
  type NumberArrayInfer = v.Infer<typeof numberArrayValidator>;
  type ObjArrayInfer = v.Infer<typeof objArrayValidator>;
  
  type _StringArrayTest = Expect<Equal<StringArrayInfer, string[]>>;
  type _NumberArrayTest = Expect<Equal<NumberArrayInfer, number[]>>;
  type _ObjArrayTest = Expect<Equal<ObjArrayInfer, { id: number }[]>>;
});
