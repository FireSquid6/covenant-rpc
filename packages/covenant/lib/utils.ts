export type MaybePromise<T> = Promise<T> | T;
export type Flatten<T> = { [key in keyof T]: T[key] } & {};
