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
  channel: string;
  params: Record<string, string>;

  constructor(message: string, channel: string, params: Record<string, string>, cause: "client" | "server" | "sidekick") {
    this.message = message;
    this.channel = channel;
    this.params = params;
    this.cause = cause;
  }

  static fromError(error: Error, channel: string, params: Record<string, string>): ThrowableChannelError {
    return new ThrowableChannelError(error.message, channel, params, "server");
  }

  static fromUnknown(error: unknown, channel: string, params: Record<string, string>): ThrowableChannelError {
    return new ThrowableChannelError(`Unknown error: ${error}`, channel, params, "server");
  }


  toChannelError(): ChannelError {
    return {
      channel: this.channel,
      params: this.params,
      message: this.message,
      fault: this.cause,
    }
  }
}


export function channelErrorFromUnknown(e: unknown, channel: string, params: Record<string, string>) {
  const err = e instanceof ThrowableChannelError
    ? e : e instanceof Error
    ? ThrowableChannelError.fromError(e, channel, params)
    : ThrowableChannelError.fromUnknown(e, channel, params);

  return err.toChannelError();
}
