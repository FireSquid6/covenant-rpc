import type { ConnectionResponse,  UntypedServerMessage } from "./channels";
import type { ProcedureError } from "./response";

export class CovenantError {
  message: string;
  httpCode: number;

  constructor(message: string, httpCode: number) {
    this.message = message;
    this.httpCode = httpCode;
  }

  static fromError(error: Error): CovenantError {
    return new CovenantError(error.message, 500);
  }

  static fromUnknown(k: unknown): CovenantError {
    return new CovenantError(`Unknown error: ${k}`, 500);
  }

  toProcedureError(): ProcedureError {
    return {
      message: this.message,
      httpCode: this.httpCode,
    }
  }
}



export class ChannelErrorWrapper {
  message: string;
  cause: "client" | "server";

  constructor(message: string, cause: "client" | "server") {
    this.message = message;
    this.cause = cause;
  }

  static fromError(error: Error): ChannelErrorWrapper {
    return new ChannelErrorWrapper(error.message, "server");
  }

  static fromUnknown(error: unknown): ChannelErrorWrapper {
    return new ChannelErrorWrapper(`Uknown error: ${error}`, "server");
  }

  // connection response and client message can look
  // the same in error cases. This may change later
  toConnectionResponse(): ConnectionResponse {
    return {
      type: "ERROR",
      error: {
        cause: this.cause,
        error: this.message,
      }
    }
  }

  toServerMessage(): UntypedServerMessage {
    return {
      type: "ERROR",
      error: {
        cause: this.cause,
        error: this.message,
      }
    }
  }


}
