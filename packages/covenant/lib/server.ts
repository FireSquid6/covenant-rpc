import type { ChannelMap, Covenant, ProcedureMap } from ".";
import { procedureRequestBodySchema, type ProcedureDefinition, type ProcedureInputs, type ProcedureRequest, type ProcedureResponse } from "./procedure";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { err, issuesToString, ok, type ArrayToMap, type AsyncResult, type MaybePromise } from "./utils";
import type { ServerToSidekickConnection } from "./interfaces";
import type { ChannelDefinition } from "./channel";
import { v } from "./validation";
import { procedureErrorFromUnknown, ThrowableProcedureError } from "./errors";
import { Logger, type LoggerLevel } from "./logger";


export type ProcedureDefinitionMap<T extends ProcedureMap, Context, Derivation> = {
  [key in keyof T]: ProcedureDefinition<T[key], Context, Derivation> | undefined
}

export type ChannelDefinitionMap<T extends ChannelMap> = {
  [key in keyof T]: ChannelDefinition<T[key]>
}

export type ContextGenerator<Context> = 
  (i: ProcedureInputs<unknown, undefined, undefined>) => MaybePromise<Context>

export type Derivation<Context, Derived> = (i: ProcedureInputs<undefined, Context, undefined>) => MaybePromise<Derived>;


export class CovenantServer<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context,
  Derived,
> {
  private covenant: Covenant<P, C>;
  private contextGenerator: ContextGenerator<Context>;
  private derivation: Derivation<Context, Derived>;
  private sidekickConnection: ServerToSidekickConnection

  private procedureDefinitions: ProcedureDefinitionMap<P, Context, Derived>;
  private channelDefinitions: ChannelDefinitionMap<C>;
  private logger: Logger;

  constructor(covenant: Covenant<P, C>, {
    contextGenerator,
    derivation,
    sidekickConnection,
    logLevel,
  }: {
    contextGenerator: ContextGenerator<Context>,
    derivation: Derivation<Context, Derived>,
    sidekickConnection: ServerToSidekickConnection,
    logLevel?: LoggerLevel,
  }) {
    this.covenant = covenant;
    this.contextGenerator = contextGenerator;
    this.derivation = derivation;
    this.sidekickConnection = sidekickConnection;
    this.logger = new Logger(logLevel ?? "info", [
      () => new Date().toUTCString(),
    ]);


    // both of these fail. We leave them emtpy and let the user
    // define them later. The `assertAllDefined can be used to do`
    // a check to ensure all channels and procedures are defined
    //
    //@ts-expect-error see above
    this.procedureDefinitions = {};
    //@ts-expect-error see above
    this.channelDefinitions = {};
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
    this.logger.info(`Sending message to ${String(name)} with params ${JSON.stringify(params)}`);
    return await this.sidekickConnection.postMessage({
      channel: String(name),
      params,
      data: message,
    });
  }

  assertAllDefined(): void {
    for (const p of Object.keys(this.covenant.procedures)) {
      if (this.procedureDefinitions[p] === undefined) {
        this.logger.fatal(`Procedure ${p} was not defined`);
      }
    }

    for (const c of Object.keys(this.covenant.channels)) {
      if (this.channelDefinitions[c] === undefined) {
        this.logger.fatal(`Channel ${c} was not defined`);
      }
    }
  }

  private async processProcedure(request: ProcedureRequest, newHeaders: Headers): Promise<ProcedureResponse> {
    let l = this.logger.sublogger(`PROCEDURE ${request.procedure}`);
    try {
      const declaration = this.covenant.procedures[request.procedure];
      const definition = this.procedureDefinitions[request.procedure];

      if (!declaration || !definition) {
        throw new ThrowableProcedureError(`Procedure ${request.procedure} not found`, 404);
      }

      const validationResult = await declaration.input["~standard"].validate(request.input);

      if (validationResult.issues) {
        throw new ThrowableProcedureError(`Error parsing procedure inputs: ${issuesToString(validationResult.issues)}`, 404);
      }

      const initialInputs: ProcedureInputs<any, undefined, undefined> = {
        inputs: validationResult.value,
        request,
        ctx: undefined,
        derived: undefined,
        logger: l,
        setHeader(name: string, value: string) {
          newHeaders.set(name, value);
        },
        deleteHeader(name: string) {
          newHeaders.delete(name);
        },
        error(message, code) {
          throw new ThrowableProcedureError(message, code);
        }
      }

      const ctx: Context = await this.contextGenerator(initialInputs);
      const derived: Derived = await this.derivation({ ...initialInputs, ctx });
      const result = await definition.procedure({ ...initialInputs, ctx, derived });
      const resources = await definition.resources({ inputs: validationResult.value, ctx, outputs: result, logger: l });

      if (declaration.type === "mutation") {
        this.sidekickConnection.update(resources).then((e) => {
          if (e !== null) {
            l.error(`Failed to send resource updates for ${resources.toString()} - ${e.message}`);
          }
        });
      }

      l.info("Returning OK")
      return {
        status: "OK",
        data: result,
        resources,
      }

    } catch (e) {
      const error = procedureErrorFromUnknown(e);
      l.error(`Returning ERR ${error.code} - ${error.message}`);
      return {
        status: "ERR",
        error,
      }
    }
  }

  private async handleProcedure(request: Request): Promise<Response> {
    const { data: parsed, error, success } = await parseRequest(request);

    if (!success) {
      this.logger.error(`Failed parsing procedure request: ${error.message}`);
      return new Response(`Error parsing request body. If you're a dev seeing this then this is probably my bad not yours. Create an issue on the covenant rpc github: ${error.message}`);
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    const res = await this.processProcedure(parsed, headers);

    const status = res.status === "OK" ? 201 : res.error.code;

    return new Response(JSON.stringify(res), {
      headers,
      status,
    });
  }


  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "procedure";

    if (request.method !== "POST") {
      return new Response("Covenant servers only handle POST requests", { status: 404 });
    }

    let response = new Response();

    switch (type) {
      case "channel":
        throw new Error("handling channels is not implemented");
      case "procedure":
        response = await this.handleProcedure(request);
        break;
      case "connect":
        throw new Error("handling connecitons is not implemented");
    }

    return response;
  }
}


export async function parseRequest(request: Request): AsyncResult<ProcedureRequest> {
  try {
    const body = await request.json();
    const result = v.parseSafe(body, procedureRequestBodySchema);
    
    if (result === null) {
      throw new Error(`Failed to parse body as a ProcedureRequestBody: ${JSON.stringify(body)}`);
    }
    const url = new URL(request.url);

    return ok({
      headers: request.headers,
      input: result.inputs,
      procedure: result.procedure,
      path: url.pathname,
      url: url.toString(),
      req: request
    });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(`Unknown error: ${e}`));
  }

}
