export { CovenantServer } from "./server";
export { Logger } from "./logger";
export { vanillaAdapter } from "./adapters/vanilla";
export { Sidekick, type SidekickClient } from "./sidekick";
export { httpServerToSidekick, httpSidekickToServer } from "./interfaces/http";
export { emptyServerToSidekick } from "./interfaces/empty";
export { directClientToServer } from "./interfaces/direct";
export { mockClientToSidekick } from "./interfaces/mock";

// Re-export types from core for convenience
export type { LoggerLevel, Prefix } from "@covenant-rpc/core/logger";
