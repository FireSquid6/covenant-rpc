import fs from "fs";
import path from "path";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelMap, ProcedureMap, Covenant, ProcedureDeclaration, ProcedureType, ChannelDeclaration, ProcedureInputs, ContextGenerator, ResourceInputs } from ".";
import type { MaybePromise } from "./utils";
import { parseRequest } from "./request";
import { CovenantError } from "./error";
import { procedureResponseToJs, type ProcedureResponse } from "./response";
import type { RealtimeConnection } from "./realtime";


export interface ParsedRequest {
  headers: Headers;
  input: unknown;
  url: string;
  procedure: string;
  path: string;
  req: Request;
}


export type ProcedureDefinition<T, Context extends StandardSchemaV1, Derivation> = T extends ProcedureDeclaration<infer Input, infer Output, ProcedureType>
  ? {
    procedure: (i: ProcedureInputs<
      StandardSchemaV1.InferOutput<Input>,
      StandardSchemaV1.InferOutput<Context>,
      Derivation
    >) => MaybePromise<StandardSchemaV1.InferOutput<Output>>
    resources: (i: ResourceInputs<
      StandardSchemaV1.InferOutput<Input>,
      StandardSchemaV1.InferOutput<Context>,
      StandardSchemaV1.InferOutput<Output>
    >) => MaybePromise<string[]>
  }
  : never


export interface ChannelInputs<ClientMessage, ConnectionContext> {
  message: ClientMessage,
  ctx: ConnectionContext,
}

export type ChannelDefinition<T> = T extends ChannelDeclaration<
  infer ClientMessage,
  infer ServerMessage,
  infer ConnectionRequest,
  infer ConnectionContext
>
  ? {
    guard: (req: StandardSchemaV1.InferOutput<ConnectionRequest>) => StandardSchemaV1.InferOutput<ConnectionContext>;
    onMessage: (i: ChannelInputs<
      StandardSchemaV1.InferOutput<ClientMessage>,
      StandardSchemaV1.InferOutput<ConnectionContext>
    >) => MaybePromise<StandardSchemaV1.InferOutput<ServerMessage>>;
    onClose: (ctx: StandardSchemaV1.InferOutput<ConnectionContext>) => void;
  } : never


export type ProcedureDefinitionMap<T extends ProcedureMap, Context extends StandardSchemaV1, Derivation> = {
  [key in keyof T]: ProcedureDefinition<T[key], Context, Derivation> | undefined
}

export type ChannelDefinitionMap<T extends ChannelMap> = {
  [key in keyof T]: ChannelDefinition<T[key]>
}

export type Derivation<Derived, Context> = (i: ProcedureInputs<undefined, Context, undefined>) => Derived;


export class CovenantServer<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context extends StandardSchemaV1,
  Data extends StandardSchemaV1,
  Derived
> {
  private covenant: Covenant<P, C, Context, Data>;
  private procedureDefinitions: ProcedureDefinitionMap<P, Context, Derived>;
  private contextGenerator: ContextGenerator<Context>;
  private derivation: Derivation<Derived, StandardSchemaV1.InferOutput<Context>>;
  private realtimeConnection: RealtimeConnection;
  private channelDefinitions: ChannelDefinitionMap<C>;


  constructor(covenant: Covenant<P, C, Context, Data>, { 
    contextGenerator,
    derivation,
    realtimeConnection
  }: {
    contextGenerator: ContextGenerator<Context>,
    derivation: Derivation<Derived, StandardSchemaV1.InferOutput<Context>>,
    realtimeConnection: RealtimeConnection
  }) {
    this.covenant = covenant;
    this.derivation = derivation;
    this.realtimeConnection  = realtimeConnection;

    // both of these fail. We assert that the user has defined everything with
    // assertAllDefined. If they haven't, this type is indeed incorrect.
    // @ts-expect-error see above
    this.procedureDefinitions = {};
    // @ts-expect-error see above
    this.channelDefinitions = {};

    this.contextGenerator = contextGenerator;
  }

  assertAllDefined(): void {
    for (const p of Object.keys(this.covenant.procedures)) {
      if (this.procedureDefinitions[p] === undefined) {
        throw new Error(`Procedure ${p} was not defined`)
      }
    }

    for (const c of Object.keys(this.covenant.channels)) {
      if (this.channelDefinitions[c] === undefined) {
        throw new Error(`Channel ${c} was not defined`);
      }
    }
  }

  // directory must be an absolute path or this will fail
  async runDefaultInDirectory(directory: string) {
    const validExtensions = [".ts", ".tsx", ".js", ".jsx"];

    await Promise.all(fs.readdirSync(directory, { recursive: true }).map(async (f) => {
      const filepath = path.join(directory, f.toString());
      const extension = path.extname(filepath);

      if (validExtensions.find(e => e === extension) === undefined) {
        console.log(`${f} is not a source file`);
        return;
      }

      try {
        const mod = await import(filepath);
        mod.default()
      } catch (e) {
        console.log(`${f} had an error:`)
        console.log(e);

        // we want to quit if there's an error
        process.exit(1);
      }
    }));
  }

  defineProcedure<N extends keyof P>(name: N, definition: ProcedureDefinition<P[N], Context, Derived>) {
    if (this.procedureDefinitions[name] !== undefined) {
      throw new Error(`Tried to define ${String(name)} twice!`);
    }

    this.procedureDefinitions[name] = definition;
  }

  defineChannel<N extends keyof C>(name: N, definition: ChannelDefinition<C[N]>) {
    if (this.channelDefinitions[name] !== undefined) {
      throw new Error(`Tried to define ${String(name)} twice!`);
    }

    this.channelDefinitions[name] = definition;
  }

  private async processProcedure(request: Request, newHeaders: Headers): Promise<ProcedureResponse<any>> {
    try {
      const parsed = await parseRequest(request);

      const route = this.covenant.procedures[parsed.procedure];
      const handler = this.procedureDefinitions[parsed.procedure];

      if (!route || !handler) {
        throw new CovenantError(`Procedure ${parsed.procedure} not found`, 404);
      }

      const validationResult = await route.input["~standard"].validate(parsed.input);
      if (validationResult.issues) {
        throw new CovenantError(`Error parsing procedure inputs: ${validationResult.issues}`, 400);
      }


      const initialInputs: ProcedureInputs<any, undefined, undefined> = {
        inputs: validationResult.value,
        request: parsed,
        ctx: undefined,
        derived: undefined,
        setHeader(name: string, value: string) {
          newHeaders.set(name, value)
        },
        deleteHeader(name: string) {
          newHeaders.delete(name)
        },
        error(message, code) {
          throw new CovenantError(message, code);
        }
      }

      let ctx = this.contextGenerator(initialInputs);
      if (ctx instanceof Promise) {
        ctx = await ctx;
      }
      const derived = this.derivation({ ...initialInputs, ctx });

      const result = await handler.procedure({ ...initialInputs, derived, ctx });
      const resources = await handler.resources({ inputs: parsed, ctx, outputs: result });

      if (route.type === "mutation") {
        this.realtimeConnection.informUpdated(resources);
      }

      return {
        result: "OK",
        data: result,
        error: undefined,
        resources,
      }

    } catch (e) {
      // kinda a confusing line but it turns our unknown error into
      // a covenant error no matter what
      const err = e instanceof CovenantError
        ? e
        : e instanceof Error
          ? CovenantError.fromError(e)
          : CovenantError.fromUnknown(e);

      return {
        result: "ERROR",
        error: err.toProcedureError(),
        data: undefined,
        resources: undefined,
      }
    }
  }

  private async handleConnectMessage(request: Request): Promise<Response> {
    return new Response("OK", { status: 200 });
  }

  private async handleChannelMessage(request: Request): Promise<Response> {
    // check if that client is even connected to the channel

    return new Response("OK", { status: 200 });
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "procedure";

    if (request.method !== "POST") {
      return new Response("Covenant servers only do POST requests", { status: 404 });
    }

    switch (type) {
      case "channel":
        return this.handleChannelMessage(request);
      case "connect":
        return this.handleConnectMessage(request);
      case "procedure":
        return this.handleProcedure(request);
    }

    return new Response(`Got an invalid type: ${type}`, { status: 400 });
  }

  private async handleProcedure(request: Request): Promise<Response> {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    const response = await this.processProcedure(request, headers);
    return procedureResponseToJs(response, headers);
  }
}

