import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

export type SchemaAnnotator = {
  [key: string]: string | SchemaAnnotator;
};

export type AnnotationResult = Record<string, { typeName: string; description: string }>;

type JSONSchemaProp = {
  type?: string;
  properties?: Record<string, JSONSchemaProp>;
};

function collectAnnotations(
  properties: Record<string, JSONSchemaProp>,
  annotator: SchemaAnnotator,
  result: AnnotationResult,
  prefix: string,
) {
  for (const [key, value] of Object.entries(annotator)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const prop = properties[key];

    if (typeof value === "object") {
      collectAnnotations(prop?.properties ?? {}, value, result, fullKey);
    } else {
      result[fullKey] = { typeName: prop?.type ?? "unknown", description: value };
    }
  }
}

export function getAnnotation<T extends StandardJSONSchemaV1>(
  schema: T,
  annotator: SchemaAnnotator,
): AnnotationResult {
  const jsonSchema = schema["~standard"].jsonSchema.output({ target: "draft-07" });
  const properties = (jsonSchema.properties ?? {}) as Record<string, JSONSchemaProp>;

  const result: AnnotationResult = {};
  collectAnnotations(properties, annotator, result, "");
  return result;
}
