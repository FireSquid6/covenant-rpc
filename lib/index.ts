import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parseRequest } from "./request";


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
  error: (cause: "server" | "client", message: string) => never;
  redirect: () => never;  // TODO

}


export type RouteDefinition<T, Context, Store> = T extends RouteDeclaration<infer Input, infer Output>
  ? (i: HandlerInputs<StandardSchemaV1.InferInput<Input>, Context, Store>) => MaybePromise<StandardSchemaV1.InferOutput<Output>>
  : never


export type InferRouteResponse<T> = T extends RouteDeclaration<any, infer Output>
  ? { status: "OK", data: StandardSchemaV1.InferOutput<Output> }
  : { status: "ERROR", fault: "server" | "client", message: string }

export type InferRouteInput<T> = T extends RouteDeclaration<infer Input, any> ? Input : any;

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
  // TODO - this should probably work differently than taking in a raw request
  private contextFn: (i: HandlerInputs<unknown, undefined, Store>) => MaybePromise<Context>
  private definitions: Record<string, RouteDefinition<RouteDeclaration<any, any>, Context, Store>>;
  store: Store;

  constructor(schema: T, contextFn: (i: HandlerInputs<unknown, undefined, Store>) => MaybePromise<Context>, store: Store) {
    this.schema = schema;
    this.contextFn = contextFn;
    this.definitions = {};
    this.store = store;
  }

  // TODO - ensure that everything is defined
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

  async handle(request: Request): Promise<Response> {
    try {
      const parsed = await parseRequest(request);

      if (parsed instanceof Response) {
        return parsed
      }

      const route = this.schema[parsed.functionName as F];
      const handler = this.definitions[parsed.functionName];

      if (!route || !handler) {
        // TODO - better handling
        throw new Error("Route not found")
      }

      const validationResult = await route.input["~standard"].validate(parsed.input);
      if (validationResult.issues) {
        // TODO - better handling
        throw new Error("issues");
      }

      // any is fine here because in this case we know more than
      // the typescript compiler does
      const initialInputs: HandlerInputs<any, undefined, Store> = {
        inputs: validationResult.value,
        request: parsed,
        ctx: undefined,
        store: this.store,
        redirect() {
          throw new Error("Redirect not implemented");
        },
        setHeader() {
          throw new Error("Set header not implemented");
        },
        error() {
          throw new Error("Error not implemented");
        },
      }

      let context = this.contextFn(initialInputs) ;
      if (context instanceof Promise) {
        context = await context;
      }

      const finalInputs: HandlerInputs<any, Context, Store> = {
        ...initialInputs,
        ctx: context,
      }

      const result = handler(finalInputs);

      return Response.json({ hello: "world" });
    } catch (e) {
      // TODO - handle errors
      return new Response();
    }
  }

  getSchema(): T {
    return this.schema;
  }
}



export type CovenantClient<F extends string, T extends Record<F, RouteDeclaration<any, any>>> = (
  func: F,
  inputs: InferRouteInput<T[F]>,
) => Promise<InferRouteResponse<T[F]>>;
