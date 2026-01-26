// Logger interface for type safety in core
// Implementation lives in @covenant/server

export type LoggerLevel = "info" | "error" | "warn" | "slient" | "debug";
export type Prefix = string | (() => string);

export interface Logger {
  prefixes: Prefix[];
  level: LoggerLevel;
  sublogger(prefix: Prefix): Logger;
  pushPrefix(prefix: Prefix): Logger;
  clone(): Logger;
  debug(text: string): void;
  info(text: string): void;
  error(text: string): void;
  warn(text: string): void;
  fatal(text: string): never;
}
