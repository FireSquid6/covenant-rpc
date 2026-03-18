import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

export type SchemaAnnotator<T extends StandardJSONSchemaV1> = {
  [K in keyof StandardSchemaV1.InferOutput<T>]: string;
};

export type AnnotationResult<T extends StandardJSONSchemaV1> = {
  [K in keyof StandardSchemaV1.InferOutput<T>]: [string, string];
};

export function getAnnotation<T extends StandardJSONSchemaV1>(
  schema: T,
  annotator: SchemaAnnotator<T>,
): AnnotationResult<T> {
  const jsonSchema = schema["~standard"].jsonSchema.output({ target: "draft-07" });
  const properties = (jsonSchema.properties ?? {}) as Record<string, { type?: string }>;

  const result: Record<string, [string, string]> = {};
  for (const [key, description] of Object.entries(annotator as Record<string, string>)) {
    const type = properties[key]?.type ?? "unknown";
    result[key] = [type, description];
  }
  return result as AnnotationResult<T>;
}
