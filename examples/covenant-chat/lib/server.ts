import { CovenantServer } from "@covenant/rpc/server";
import { covenant } from "./covenant";
import { httpServerToSidekick } from "@covenant/rpc/interfaces/http";
import { assertReadFromEnv } from "./utils";
import { defineAll } from "./definitions";

const sidekickSecret = assertReadFromEnv("SIDEKICK_SECRET");
const sidekickUrl = assertReadFromEnv("NEXT_PUBLIC_SIDEKICK_URL");

export const server = new CovenantServer(covenant, {
  contextGenerator: () => undefined,
  derivation: () => {},
  sidekickConnection: httpServerToSidekick(sidekickUrl, sidekickSecret),
});

defineAll();
