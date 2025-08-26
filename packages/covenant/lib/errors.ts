import type { ChannelError } from "./channel";
import type { ProcedureError } from "./procedure";

export class ThrowableProcedureError {
  message: string;
  httpCode: number;

  constructor(message: string, httpCode: number) {
    this.message = message;
    this.httpCode = httpCode;
  }

  static fromError(error: Error): ThrowableProcedureError {
    return new ThrowableProcedureError(error.message, 500);
  }

  static fromUnknown(k: unknown): ThrowableProcedureError {
    return new ThrowableProcedureError(`Unknown error: ${k}`, 500);
  }

  toProcedureError(): ProcedureError {
    return {
      message: this.message,
      code: this.httpCode,
    }
  }
}


export function procedureErrorFromUnknown(e: unknown) {
  const err = e instanceof ThrowableProcedureError
    ? e : e instanceof Error
    ? ThrowableProcedureError.fromError(e)
    : ThrowableProcedureError.fromUnknown(e);

  return err.toProcedureError();
}


export class ThrowableChannelError {
  message: string;
  cause: "client" | "server" | "sidekick";

  constructor(message: string, cause: "client" | "server" | "sidekick") {
    this.message = message;
    this.cause = cause;
  }

  static fromError(error: Error): ThrowableChannelError {
    return new ThrowableChannelError(error.message, "server");
  }

  static fromUnknown(error: unknown): ThrowableChannelError {
    return new ThrowableChannelError(`Uknown error: ${error}`, "server");
  }


  toChannelError(channel: string, params: Record<string, string>): ChannelError {
    return {
      channel,
      params,
      message: this.message,
      fault: this.cause,
    }
  }
}


export function channelErrorFromUnkown(channel: string, params: Record<string, string>, e: unknown) {
  const err = e instanceof ThrowableChannelError
    ? e : e instanceof Error
    ? ThrowableChannelError.fromError(e)
    : ThrowableChannelError.fromUnknown(e);

  return err.toChannelError(channel, params);
}
