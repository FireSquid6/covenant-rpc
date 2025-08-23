import fs from "fs";
import path from "path";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelMap, ProcedureMap, Covenant, ProcedureDeclaration, ProcedureType, ChannelDeclaration, ProcedureInputs, ContextGenerator, ResourceInputs } from ".";
import type { ArrayToMap, MaybePromise } from "./utils";
import { parseRequest } from "./request";
import { ChannelErrorWrapper, CovenantError } from "./error";
import { procedureResponseToJs, type ProcedureResponse } from "./response";
import type { RealtimeConnection } from "./realtime";
import { connectionRequest, sidekickChannelMessage, type ConnectionRequest, type ConnectionResponse, type SidekickChannelMessage, type UntypedServerMessage } from "./channels";


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



export type ProcedureDefinitionMap<T extends ProcedureMap, Context extends StandardSchemaV1, Derivation> = {
  [key in keyof T]: ProcedureDefinition<T[key], Context, Derivation> | undefined
}

export interface ConnectionHandlerInputs<T, Params> {
  inputs: T,
  params: Params,
  // originalRequest: Request,
  reject(reason: string, cause: "client" | "server"): never,
}

export interface MessageHandlerInputs<T, Params, Context> {
  inputs: T,
  params: Params,
  context: Context,
  error(reason: string, cause: "client" | "server"): never,
}

export type ChannelDefinition<T> = T extends ChannelDeclaration<
  infer ClientMessage,
  any,
  infer ConnectionRequest,
  infer ConnectionContext,
  infer Params
> ? {
  onConnect: (i: ConnectionHandlerInputs<
    StandardSchemaV1.InferOutput<ConnectionRequest>,
    ArrayToMap<Params>
  >) => MaybePromise<
    StandardSchemaV1.InferOutput<ConnectionContext>
  >;
  onMessage: (i: MessageHandlerInputs<
    StandardSchemaV1.InferOutput<ClientMessage>,
    ArrayToMap<Params>,
    StandardSchemaV1.InferOutput<ConnectionContext>
  >) => MaybePromise<
    void
  >
} : never

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
    this.realtimeConnection = realtimeConnection;

    // both of these fail. We assert that the user has defined everything with
    // assertAllDefined later. If they haven't, this type is indeed incorrect.
    //
    // This is crucial for the way covenant works. Our typesafety sits on a throne
    // of lies
    //
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

  async sendMessage<N extends keyof C>(
    name: N,
    params: ArrayToMap<C[N]["params"]>,
    message: StandardSchemaV1.InferOutput<C[N]["serverMessage"]>
  ): Promise<Error | null> {
    const msg: UntypedServerMessage = {
      type: "OK",
      message,
      params,
      channel: String(name),
    }

    return await this.realtimeConnection.sendMessage(msg);
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

      console.log(parsed.procedure);

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

      const ctx = await this.contextGenerator(initialInputs);
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


  private async processConnectionRequest(request: ConnectionRequest): Promise<ConnectionResponse> {
    try {
      const definition = this.channelDefinitions[request.channel];
      const declaration = this.covenant.channels[request.channel];

      if (!definition || !declaration) {
        throw new ChannelErrorWrapper(`Channel ${definition} not found.`, "client");
      }
      const params = request.params;

      if (!isProperParams(declaration.params, params)) {
        throw new ChannelErrorWrapper(`Params did not match the params ${declaration.params}.`, "client");
      }

      const reject = (reason: string, cause: "server" | "client") => {
        throw new ChannelErrorWrapper(reason, cause);
      }

      console.log(request.connectionRequest);
      const valid = await declaration.connectionRequest["~standard"].validate(request.connectionRequest);

      if (valid.issues) {
        // the reason we actually want to return a 201 OK but with the error is because
        // we want this error to be sent in the websocket. Errors in the handleConnectionRequest
        // are caused by a sidekick instance fucking up (our skill issue) while this error would
        // be caused by the client fucking up (library user's skill issue)
        //
        // I mostly did it this way at first because making a big generic schema was harder and
        // more brain intensive than just going grug mode and validating twice, but I think it's
        // actually a fairly smart decision now that I think about it.
        let str = "";
        for (const issue of valid.issues) {
          str += `${issue.path}:  ${issue.message}, `;

        }
        throw new ChannelErrorWrapper(`Channel message was incorrect: ${str}`, "client")
      }

      // ok this is kinda weird
      //
      // what we do is the original connection request to the sidekick websocket is serialized. This
      // allows us to use the cookies (auth for example) to derive the context of this connection and
      // do auth stuff
      //
      // It's important to have the client restart its connection each time the cookies would change
      // because this is only the cookies at the *start* of whenever the client connects.

      const context = await definition.onConnect({
        reject,
        params: params,
        inputs: valid.value,
      });

      return {
        type: "OK",
        context,
      }


    } catch (e) {
      const err: ChannelErrorWrapper = e instanceof ChannelErrorWrapper
        ? e
        : e instanceof Error
          ? ChannelErrorWrapper.fromError(e)
          : ChannelErrorWrapper.fromUnknown(e);

      return err.toConnectionResponse();
    }
  }


  private async handleConnectMessage(request: Request): Promise<Response> {
    const body = await request.json();
    const validated = await connectionRequest["~standard"].validate(body);

    if (validated.issues) {
      return new Response(`Error parsing: ${validated.issues}`, { status: 400 });
    }

    const result = await this.processConnectionRequest(validated.value);

    return Response.json(result, { status: 201 });
  }

  // this one doesn't return anything because messages are sent through a separate request system
  private async processChannelMessage(message: SidekickChannelMessage): Promise<void> {
    try {
      const definition = this.channelDefinitions[message.channel];
      const declaration = this.covenant.channels[message.channel];

      if (!definition || !declaration) {
        await this.realtimeConnection.sendMessage({
          type: "ERROR",
          error: {
            error: `channel ${message.channel} does not exist`,
            cause: "client",
          }
        });
        return;
      }
      console.log(message);

      const msgValid = await declaration.clientMessage["~standard"].validate(message.message);

      if (msgValid.issues) {
        throw new ChannelErrorWrapper(`Message did not match schema: ${JSON.stringify(msgValid.issues)}`, "client");
      }

      const ctxValid = await declaration.connectionContext["~standard"].validate(message.context);
      if (ctxValid.issues) {
        throw new ChannelErrorWrapper(`Context did not match schema: ${JSON.stringify(ctxValid.issues)}`, "server");
      }

      if (!isProperParams(declaration.params, message.params)) {
        throw new ChannelErrorWrapper(`Params did not match schema`, "client");
      }


      const context = ctxValid.value;
      const msg = msgValid.value;

      await definition.onMessage({
        inputs: msg,
        params: message.params,
        context,
        error: (reason: string, cause: "client" | "server") => {
          throw new ChannelErrorWrapper(reason, cause)
        }
      })
    } catch (e) {
      const err: ChannelErrorWrapper = e instanceof ChannelErrorWrapper
        ? e
        : e instanceof Error
          ? ChannelErrorWrapper.fromError(e)
          : ChannelErrorWrapper.fromUnknown(e);

      await this.realtimeConnection.sendMessage({
        type: "ERROR",
        error: {
          error: err.message,
          cause: err.cause,
        }
      })

    }
  }


  private async handleChannelMessage(request: Request): Promise<Response> {
    // check if that client is even connected to the channel
    const body = await request.json();
    const { data, error, success } = sidekickChannelMessage.safeParse(body);

    if (!success) {
      // TODO - turn every instance of this to empty body but error in status text
      return new Response(`Error parsing: ${error}`, { status: 400 });
    }
    const valid = this.realtimeConnection.validateKey(data.key);
    if (!valid) {
      return new Response(`Key not valid`, { status: 401 });
    }

    await this.processChannelMessage(data);
    return new Response("OK", { status: 201 });
  }


  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "procedure";

    if (request.method !== "POST") {
      return new Response("Covenant servers only do POST requests", { status: 404 });
    }

    let res = new Response();
    switch (type) {
      case "channel":
        res = await this.handleChannelMessage(request);
        break;
      case "connect":
        res = await this.handleConnectMessage(request);
        break;
      case "procedure":
        res = await this.handleProcedure(request);
        break;
      default:
        res = new Response(`Got an invalid type: ${type}`, { status: 400 });
        break;
    }


    console.log(`Handled ${type} -> ${res.status}`)
    return res;
  }

  private async handleProcedure(request: Request): Promise<Response> {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    const response = await this.processProcedure(request, headers);
    return procedureResponseToJs(response, headers);
  }
}


function isProperParams<T extends string[]>(properties: T, params: Record<string, string>): params is ArrayToMap<T> {
  const m = new Map<string, boolean>();
  for (const p of properties) {
    m.set(p, false);
  }

  for (const k of Object.keys(params)) {
    const seen = m.get(k);

    if (seen === undefined) {
      return false;
    }

    if (seen === true) {
      // should be unreachable. Not sure how
      // a record would have duplicates
      return false;
    }

    m.set(k, true);
  }

  for (const v of m.values()) {
    if (v === false) {
      return false;
    }
  }

  return true;
}
