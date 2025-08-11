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


