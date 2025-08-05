import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChannelMap, ProcedureMap, Covenant, ProcedureDeclaration } from ".";
import type { MaybePromise } from "./utils";
import { parseRequest } from "./request";
import { CovenantError } from "./error";
import { procedureResponseToJs, type ProcedureResponse } from "./response";


export interface ProcedureInputs<Inputs, Context> {
  inputs: Inputs,
  ctx: Context,
  request: ParsedRequest,
  setHeader: (name: string, value: string) => void;
  deleteHeader: (name: string) => void;
  error: (message: string, code: number) => never;
}

export interface ParsedRequest {
  headers: Headers;
  input: unknown;
  url: string;
  procedure: string;
  path: string;
  req: Request;
}


export type ProcedureDefinition<T, Context> = T extends ProcedureDeclaration<infer Input, infer Output>
  ? (i: ProcedureInputs<Input, Context>) => MaybePromise<StandardSchemaV1.InferOutput<Output>>
  : never


export type DefinitionMap<T extends ProcedureMap, Context> = { 
  [key in keyof T]: ProcedureDefinition<T[key], Context> | undefined 
}

export type ContextGenerator<Context> = (i: ProcedureInputs<unknown, undefined>) => Context;



export class CovenantServer<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context,
> {
  private covenant: Covenant<P, C>;
  private procedureDefinitions: DefinitionMap<P, Context>;
    contextGenerator: ContextGenerator<Context>;


  constructor(covenant: Covenant<P, C>, { contextGenerator }: {
    contextGenerator: ContextGenerator<Context>
  }) {
    this.covenant = covenant;
    // @ts-expect-error this should actually fail because we define the
    // procedureDefinitions at runtime
    this.procedureDefinitions = {};
    this.contextGenerator = contextGenerator;
  }


  defineChannel() {
    throw new Error("Channels not implemented yet");
  }

  assertAllDefined(): void {

  }

  defineProcedure<N extends keyof P>(name: N, definition: ProcedureDefinition<P[N], Context>) {
    if (this.procedureDefinitions[name] !== undefined) {
      throw new Error(`Tried to define ${String(name)} twice!`);
    }

    this.procedureDefinitions[name] = definition;
  }

  private async getResponse(request: Request, newHeaders: Headers): Promise<ProcedureResponse<any>> {
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
      
      
      const initialInputs: ProcedureInputs<any, undefined> = {
        inputs: validationResult.value,
        request: parsed,
        ctx: undefined,
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

      const finalInputs: ProcedureInputs<any, Context> = {
        ...initialInputs,
        ctx,
      }

      const result = await handler(finalInputs);

      return {
        result: "OK",
        data: result,
        error: undefined,
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
      }
    }
  }

  async handleProcedure(request: Request): Promise<Response> {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    const response = await this.getResponse(request, headers);
    return procedureResponseToJs(response, headers);
  }
}

