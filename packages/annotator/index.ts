import type { ProcedureDeclaration } from "@covenant-rpc/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type AnnotatorForType<T> = T extends object
  ? { [K in keyof T]-?: AnnotatorForType<T[K]> }
  : string;

export type SchemaAnnotator<T extends StandardSchemaV1> = AnnotatorForType<
  StandardSchemaV1.InferOutput<T>
>;

export type AnnotationResult = Record<string, { typeName: string; description: string }>;

type JSONSchemaProp = {
  type?: string;
  properties?: Record<string, JSONSchemaProp>;
};

function zodDefToProp(def: Record<string, unknown>): JSONSchemaProp {
  const typeName = def["typeName"] as string;
  if (typeName === "ZodObject") {
    const shape = (def["shape"] as () => Record<string, { _def: Record<string, unknown> }>)();
    return { type: "object", properties: zodShapeToProperties(shape) };
  }
  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    return zodDefToProp((def["innerType"] as { _def: Record<string, unknown> })._def);
  }
  const typeMap: Record<string, string> = {
    ZodString: "string",
    ZodNumber: "number",
    ZodBoolean: "boolean",
    ZodArray: "array",
    ZodNull: "null",
    ZodBigInt: "integer",
  };
  return { type: typeMap[typeName] ?? "unknown" };
}

function zodShapeToProperties(
  shape: Record<string, { _def: Record<string, unknown> }>,
): Record<string, JSONSchemaProp> {
  const props: Record<string, JSONSchemaProp> = {};
  for (const [key, field] of Object.entries(shape)) {
    props[key] = zodDefToProp(field._def);
  }
  return props;
}

function getJSONSchemaProperties(schema: StandardSchemaV1): Record<string, JSONSchemaProp> {
  const std = schema["~standard"] as unknown as Record<string, unknown>;

  // StandardJSONSchemaV1: ~standard.jsonSchema.output()
  const jsonSchema = std["jsonSchema"] as { output?: (opts: unknown) => Record<string, unknown> } | undefined;
  if (typeof jsonSchema?.output === "function") {
    const js = jsonSchema.output({ target: "draft-07" });
    return (js["properties"] ?? {}) as Record<string, JSONSchemaProp>;
  }

  // ArkType and similar: ~standard.toJSONSchema()
  const toJSONSchema = std["toJSONSchema"] as ((opts: unknown) => Record<string, unknown>) | undefined;
  if (typeof toJSONSchema === "function") {
    const js = toJSONSchema({ target: "draft-2020-12" });
    return (js["properties"] ?? {}) as Record<string, JSONSchemaProp>;
  }

  // Zod: _def.typeName / _def.shape()
  const def = (schema as unknown as { _def?: Record<string, unknown> })._def;
  if (def?.["typeName"] === "ZodObject" && typeof def["shape"] === "function") {
    return zodShapeToProperties(
      (def["shape"] as () => Record<string, { _def: Record<string, unknown> }>)(),
    );
  }

  return {};
}

function collectAnnotations(
  properties: Record<string, JSONSchemaProp>,
  annotator: Record<string, unknown>,
  result: AnnotationResult,
  prefix: string,
) {
  for (const [key, value] of Object.entries(annotator)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const prop = properties[key];

    if (value !== null && typeof value === "object") {
      collectAnnotations(prop?.properties ?? {}, value as Record<string, unknown>, result, fullKey);
    } else if (typeof value === "string") {
      result[fullKey] = { typeName: prop?.type ?? "unknown", description: value };
    }
  }
}

export function getAnnotation<T extends StandardSchemaV1>(
  schema: T,
  annotator: Record<string, unknown>,
): AnnotationResult {
  const properties = getJSONSchemaProperties(schema);
  const result: AnnotationResult = {};
  collectAnnotations(properties, annotator, result, "");
  return result;
}

export type ProcedureAnnotator<T> = T extends ProcedureDeclaration<infer I, infer O, any>
  ? { description: string; inputAnnotation: SchemaAnnotator<I>; outputAnnotation: SchemaAnnotator<O> }
  : never
