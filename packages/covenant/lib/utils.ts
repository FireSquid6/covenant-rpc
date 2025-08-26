
export type MaybePromise<T> = T | Promise<T>;
export type Flatten<T> = { [k in keyof T]: T[k] } & {};
export type ArrayToMap<T extends readonly string[]> = { [k in T[number]]: string };



export type Result<T> = {
  success: true;
  data: T;
  error: null;
} | {
  success: false;
  data: null;
  error: Error
}

export type AsyncResult<T> = Promise<Result<T>>


export function ok<T>(t: T): Result<T> {
  return {
    data: t,
    success: true,
    error: null,
  }
}

export function err(error: Error): Result<any> {
  return {
    data: null,
    success: false,
    error,
  }
}
