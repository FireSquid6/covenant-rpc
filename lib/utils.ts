export type Flatten<T> = { [k in keyof T ]: T[k] } & {};
