

export interface Logger {
  sublogger(prefix: string): Logger;
  info(text: string): void;
  error(text: string): void;
  warn(text: string): void;
}

export class ConsoleLogger implements Logger {
  prefixes: string[];

  constructor(prefixes: string[] = []) {
    this.prefixes = prefixes;
  }

  sublogger(prefix: string): Logger {
    return new ConsoleLogger([...this.prefixes, prefix]);
  }

  info(text: string): void {
    console.log(`INFO: ${text}`);
  }

  error(text: string): void {
    console.log(`ERROR: ${text}`);
  }

  warn(text: string): void {
    console.log(`WARNING: ${text}`);
  }
}
