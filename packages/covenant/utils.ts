import type { StandardSchemaV1 } from "@standard-schema/spec";

export type MaybePromise<T> = T | Promise<T>;
export type Flatten<T> = { [k in keyof T]: T[k] } & {};

