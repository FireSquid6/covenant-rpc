import type { ChannelMap, Covenant, ProcedureMap } from ".";
import { procedureRequestBodySchema, type ProcedureDefinition, type ProcedureInputs, type ProcedureRequest, type ProcedureResponse } from "./procedure";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { err, issuesToString, ok, type ArrayToMap, type AsyncResult, type MaybePromise } from "./utils";
import type { ServerToSidekickConnection } from "./interfaces";
import { channelConnectionRequestSchema, serverMessageWithContext, type ChannelConnectionResponse, type ChannelDefinition } from "./channel";
import { v } from "./validation";
import { procedureErrorFromUnknown, ThrowableProcedureError, ThrowableChannelError, channelErrorFromUnknown } from "./errors";
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

  async postChannelMessage<N extends keyof C>(
    name: N,
    params: ArrayToMap<C[N]["params"]>,
    message: StandardSchemaV1.InferOutput<C[N]["serverMessage"]>
  ): Promise<Error | null> {
    return await this.sendMessage(name, params, message);
  }

  async processChannelMessage(channelName: string, params: Record<string, string>, data: any, context: any): Promise<{ fault: "client" | "server"; message: string } | null> {
    let l = this.logger.sublogger(`CHANNEL ${channelName}`);
    try {
      const declaration = this.covenant.channels[channelName];
      const definition = this.channelDefinitions[channelName];

      if (!declaration || !definition) {
        return {
          fault: "server",
          message: `Channel ${channelName} not found`,
        };
      }

      // Validate client message
      const validation = await declaration.clientMessage["~standard"].validate(data);
      if (validation.issues) {
        return {
          fault: "client",
          message: `Invalid message data: ${issuesToString(validation.issues)}`,
        };
      }

      // Call onMessage handler
      try {
        await definition.onMessage({
          inputs: validation.value,
          params: params as any,
          context,
          error(reason: string, cause: "client" | "server"): never {
            throw new ThrowableChannelError(reason, channelName, params, cause);
          },
        });

        l.info(`Processed message successfully`);
        return null;
      } catch (e) {
        const error = channelErrorFromUnknown(e, channelName, params);
        l.error(`Message processing failed: ${error.message}`);
        return {
          fault: error.fault === "sidekick" ? "server" : error.fault,
          message: error.message,
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      l.error(`Unexpected error: ${error}`);
      return {
        fault: "server",
        message: error,
      };
    }
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

  private async handleChannelMessage(request: Request): Promise<Response> {
    let l = this.logger.sublogger(`CHANNEL_MESSAGE`);
    try {
      const body = await request.json();
      const validation = v.parseSafe(body, serverMessageWithContext);

      if (validation === null) {
        throw new Error(`Invalid channel message: ${JSON.stringify(body)}`);
      }

      const { channel, params, data, context } = validation;

      const result = await this.processChannelMessage(channel, params, data, context);

      if (result !== null) {
        l.error(`Channel message processing failed: ${result.fault} - ${result.message}`);
        return new Response(JSON.stringify(result), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(null, {
        status: 204,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      l.error(`Channel message failed: ${error}`);
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleConnectionRequest(request: Request): Promise<Response> {
    let l = this.logger.sublogger(`CONNECTION`);

    let channelName = "unknown";
    let params: Record<string, string> = {};

    try {
      const body = await request.json();
      const validation = v.parseSafe(body, channelConnectionRequestSchema);

      if (validation === null) {
        throw new Error(`Invalid connection request: ${JSON.stringify(body)}`);
      }

      channelName = validation.channel;
      params = validation.params;
      const data = validation.data;

      const declaration = this.covenant.channels[channelName];
      const definition = this.channelDefinitions[channelName];

      if (!declaration || !definition) {
        throw new ThrowableChannelError(
          `Channel ${channelName} not found`,
          channelName,
          params,
          "server"
        );
      }

      // Validate connection request data
      const connectionRequestValidation = await declaration.connectionRequest["~standard"].validate(data);
      if (connectionRequestValidation.issues) {
        throw new ThrowableChannelError(
          `Invalid connection request data: ${issuesToString(connectionRequestValidation.issues)}`,
          channelName,
          params,
          "client"
        );
      }

      // Call onConnect handler
      const context = await definition.onConnect({
        inputs: connectionRequestValidation.value,
        params: params as any,
        reject(reason: string, cause: "client" | "server"): never {
          throw new ThrowableChannelError(reason, channelName, params, cause);
        },
      });

      // Generate token
      const token = crypto.randomUUID();

      // Add connection to sidekick
      await this.sidekickConnection.addConnection({
        token,
        channel: channelName,
        params,
        context,
      });

      l.info(`Connection established for ${channelName} with token ${token}`);

      const response: ChannelConnectionResponse = {
        channel: channelName,
        params,
        result: {
          type: "OK",
          token,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      if (e instanceof ThrowableChannelError) {
        const error = e.toChannelError();
        l.error(`Connection rejected: ${error.message}`);

        const response: ChannelConnectionResponse = {
          channel: channelName,
          params,
          result: {
            type: "ERROR",
            error,
          },
        };

        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const error = e instanceof Error ? e.message : String(e);
      l.error(`Connection failed: ${error}`);
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
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
        response = await this.handleChannelMessage(request);
        break;
      case "procedure":
        response = await this.handleProcedure(request);
        break;
      case "connect":
        response = await this.handleConnectionRequest(request);
        break;
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
