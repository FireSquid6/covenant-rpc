


export type LoggerLevel = "info" | "error" | "warn" | "slient" | "debug";
const loggerLevels: Record<LoggerLevel, number> = { "slient": 0, "error": 1, "warn": 2, "info": 3, "debug": 4 };

function levelSatisfies(currentLevel: LoggerLevel, maxLevel: LoggerLevel): boolean {
  return loggerLevels[currentLevel] <= loggerLevels[maxLevel];
}

export type Prefix = string | (() => string);

export class Logger {
  prefixes: Prefix[];
  level: LoggerLevel

  constructor(level: LoggerLevel, prefixes: Prefix[] = []) {
    this.prefixes = prefixes;
    this.level = level;
  }

  sublogger(prefix: Prefix): Logger {
    return new Logger(this.level, [...this.prefixes, prefix]);
  }

  pushPrefix(prefix: Prefix): Logger {
    this.prefixes.push(prefix);
    return this
  }

  clone(): Logger {
    return new Logger(this.level, [...this.prefixes]);
  }

  debug(text: string): void {
    if (!levelSatisfies("debug", this.level)) {
      return;
    }

    console.log(`${this.getPrefix()}DEBUG: ${text}`);
  }

  info(text: string): void {
    if (!levelSatisfies("info", this.level)) {
      return;
    }

    console.log(`${this.getPrefix()}INFO: ${text}`);
  }

  error(text: string): void {
    if (!levelSatisfies("error", this.level)) {
      return;
    }

    console.log(`${this.getPrefix()}ERROR: ${text}`);
  }

  warn(text: string): void {
    if (!levelSatisfies("error", this.level)) {
      return;
    }

    console.log(`${this.getPrefix()}WARNING: ${text}`);
  }

  fatal(text: string): never {
    console.log("---------------------------------");
    console.log(`${this.getPrefix()}FATAL: ${text}`);
    console.log("---------------------------------");
    process.exit(1);
  }

  private getPrefix(): string {
    if (this.prefixes.length === 0) {
      return "";
    }
    const strs = this.prefixes.map(p => typeof p === "string" ? p : p());
    return `[${strs.join(" |> ")}] `;

  }
}

