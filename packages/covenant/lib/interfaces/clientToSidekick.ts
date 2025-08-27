import type { ClientToSidekickConnection } from ".";

export function emptyClientToSidekick(): ClientToSidekickConnection {
  return {
    sendMessage() {

    },
    onMessage() {
      return () => {};
    },
  }
}
