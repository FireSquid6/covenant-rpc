import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parseRequest, type CovenantRequest } from "./request";
import { handleCatch, covenantResponseToJsResonse, type CovenantResponse, getResponseSchema } from "./response";
import type { Fetcher } from "./client";


export interface RouteDeclaration<
  InputSchema extends StandardSchemaV1,
  OutputSchema extends StandardSchemaV1,
> {
  input: InputSchema;
  output: OutputSchema;
}

export interface HandlerInputs<Inputs, Context, Store> {
  inputs: Inputs;
  ctx: Context;
  request: ParsedRequest;
  store: Store;
  setHeader: (name: string, value: string) => void;
  error: (cause: "server" | "client", message: string, httpCode?: number) => never;
  redirect: (to: string, type: "permanent" | "temporary") => never;  // TODO

}


export type RouteDefinition<T, Context, Store> = T extends RouteDeclaration<infer Input, infer Output>
  ? (i: HandlerInputs<StandardSchemaV1.InferInput<Input>, Context, Store>) => MaybePromise<StandardSchemaV1.InferOutput<Output>>
  : never


export type InferRouteInput<T> = T extends RouteDeclaration<infer Input, any> ? Input : never;
export type InferRouteResponse<T> = T extends RouteDeclaration<any, infer Output> ? CovenantResponse<Output> : never;

export type MaybePromise<T> = Promise<T> | T;


export interface ParsedRequest {
  headers: Headers;
  input: unknown;
  url: string;
  functionName: string;
  path: string;
  req: Request;
}


export class Covenant<
  F extends string,
  T extends Record<F, RouteDeclaration<StandardSchemaV1, StandardSchemaV1>>,
  Context,
  Store,
> {
  private schema: T;
  private contextFn: (i: HandlerInputs<unknown, undefined, Store>) => MaybePromise<Context>
  private definitions: Record<string, RouteDefinition<RouteDeclaration<any, any>, Context, Store>>;
  store: Store;

  constructor(schema: T, contextFn: (i: HandlerInputs<unknown, undefined, Store>) => MaybePromise<Context>, store: Store) {
    this.schema = schema;
    this.contextFn = contextFn;
    this.definitions = {};
    this.store = store;
  }

  assertDefined() {
    const notImplemented: string[] = []
    for (const name of Object.keys(this.schema)) {
      const implementation = this.definitions[name];
      if (!implementation) {
        notImplemented.push(name);
      }
    }

    if (notImplemented.length > 0) {
      throw new Error(`Not all function implemented: ${notImplemented.join(", ")}`)
    }

  }

  define<D extends F>(func: D, definition: RouteDefinition<T[D], Context, Store>) {
    if (this.definitions[func] !== undefined) {
      throw new Error(`Tried to define ${func} twice!`);
    }

    this.definitions[func] = definition;
  }

  private async getResponse(request: Request): Promise<[CovenantResponse<any>, Headers]> {
    const newHeaders: Headers = { ...request.headers };

    try {
      const parsed = await parseRequest(request);

      const route = this.schema[parsed.functionName as F];
      const handler = this.definitions[parsed.functionName];

      if (!route || !handler) {
        // TODO - better handling
        throw new CovenantError("Route not found", "client", 404);
      }

      const validationResult = await route.input["~standard"].validate(parsed.input);
      if (validationResult.issues) {
        // TODO - better handling
        throw new CovenantError(`Error parsing the inputs: ${validationResult.issues}`, "client", 400);
      }

      // any is fine here because in this case we know more than
      // the typescript compiler does
      const initialInputs: HandlerInputs<any, undefined, Store> = {
        inputs: validationResult.value,
        request: parsed,
        ctx: undefined,
        store: this.store,
        redirect(to, type) {
          throw new CovenantRedirect(to, type)
        },
        setHeader(name: string, value: string) {
          newHeaders.set(name, value);
        },
        error(cause, message, code) {
          throw new CovenantError(message, cause, code);
        },
      }

      let context = this.contextFn(initialInputs);
      if (context instanceof Promise) {
        context = await context;
      }

      const finalInputs: HandlerInputs<any, Context, Store> = {
        ...initialInputs,
        ctx: context,
      }

      const result = handler(finalInputs);

      return [
        {
          status: "OK",
          body: result,
        },
        newHeaders,
      ]

    } catch (e) {
      const res = handleCatch(e);
      return [res, newHeaders];
    }
  }

  async handle(request: Request): Promise<Response> {
    const [response, headers] = await this.getResponse(request);
    return covenantResponseToJsResonse(response, headers);

  }

  getSchema(): T {
    return this.schema;
  }

  getClient(fetcher: Fetcher): CovenantClient<F, T> {
    return async (func, inputs): Promise<InferRouteResponse<T[F]>> => {
      const req: CovenantRequest = {
        function: func,
        inputs: inputs,
      }

      const res = await fetcher(req)
      const outputSchema = this.schema[func].output;
      
      const body = await res.json();
      const responseSchema = getResponseSchema(outputSchema);

      const validation = await responseSchema["~standard"].validate(body);

      if (validation.issues) {
        return {
          status: "ERROR",
          httpCode: res.status,
          fault: "server",
          message: `Bad response with validation issues: ${validation.issues}`
        } as InferRouteResponse<T[F]>;
      }

      // we know more than the typescript compiler in this case
      // so we can force a typecast here. Don't worry--we do test
      // this code
      return validation.value as InferRouteResponse<T[F]>;
    }

  }
}


export class CovenantError {
  fault: "server" | "client";
  message: string;
  httpCode: number;

  constructor(message: string, fault: "server" | "client", httpCode?: number) {
    this.message = message;
    this.fault = fault;
    this.httpCode = httpCode === undefined
      ? fault === "server"
        ? 500
        : 400
      : httpCode;
  }

  static fromError(error: Error): CovenantError {
    return new CovenantError(error.message, "server", 500);
  }

  static fromUnknown(k: unknown): CovenantError {
    return new CovenantError(`Unknown error: ${k}`, "server", 500);
  }
}

export class CovenantRedirect {
  type: "permanent" | "temporary";
  to: string;

  constructor(to: string, type: "temporary" | "permanent") {
    this.to = to;
    this.type = type;
  }
}


export type CovenantClient<F extends string, T extends Record<F, RouteDeclaration<any, any>>> = (
  func: F,
  inputs: InferRouteInput<T[F]>,
) => Promise<InferRouteResponse<T[F]>>;
