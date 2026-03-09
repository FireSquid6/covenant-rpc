import type { ChannelMap, Covenant, ProcedureMap } from "@covenant-rpc/core";
import { v } from "@covenant-rpc/core/validation";
import ION from "@covenant-rpc/ion";
import type { LoggerLevel } from "@covenant-rpc/core/logger";
import { directSidekickToServer, directServerToSidekick } from "@covenant-rpc/server/interfaces/direct";
import type { Derivation } from "@covenant-rpc/server/server";
import type { ContextGenerator } from "@covenant-rpc/server/server";
import { CovenantServer } from "@covenant-rpc/server/server";
import { Sidekick, type SidekickClient } from "@covenant-rpc/server";
import type { SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";
import { randomUUIDv7, type Server } from "bun";
import { sidekickIncomingMessageSchema } from "@covenant-rpc/core/sidekick/protocol";

export interface WebSocketData {
  id: string;
}

export class SidekickIntegratedCovenantServer<
  P extends ProcedureMap,
  C extends ChannelMap,
  Context,
  Derived,
> extends CovenantServer<P, C, Context, Derived> {
  private sidekick: Sidekick;
  private server: Server<WebSocketData> | null = null;

  constructor(covenant: Covenant<P, C>, {
    contextGenerator,
    derivation,
    logLevel,
  }: {
    contextGenerator: ContextGenerator<Context>,
    derivation: Derivation<Context, Derived>,
    logLevel?: LoggerLevel,
  }) {
    // sidekickConnection is assigned below after sidekick is created
    super(covenant, { contextGenerator, derivation, logLevel, sidekickConnection: null as any });

    this.sidekick = new Sidekick(
      (topic, message) => this.publish(topic, message),
      directSidekickToServer(this),
    );
    this.sidekickConnection = directServerToSidekick(this.sidekick);
  }

  private async publish(topic: string, message: SidekickOutgoingMessage) {
    if (this.server === null) return; // no clients connected yet, nothing to broadcast
    this.server.publish(topic, ION.stringify(message));
  }

  handleSocket(request: Request, server: Server<WebSocketData>): Response | undefined {
    if (this.server === null) this.server = server;

    const upgraded = server.upgrade(request, {
      data: { id: randomUUIDv7() },
    });

    if (upgraded) return undefined;
    return new Response("WebSocket upgrade failed", { status: 400 });
  }

  getWebsocket(): Bun.WebSocketHandler<WebSocketData> {
    const sidekick = this.sidekick;

    return {
      open(_ws) {
        // subscriptions are managed per-message via ws.subscribe()
      },
      async message(ws, raw: string | Buffer) {
        const str = typeof raw === "string" ? raw : raw.toString();

        let parsed: unknown;
        try {
          parsed = ION.parse(str);
        } catch {
          const err: SidekickOutgoingMessage = {
            type: "error",
            error: {
              fault: "client",
              message: "Failed to parse last message as an incoming message. This is a bug in covenant's client code.",
              params: {},
              channel: "unknown",
            },
          };
          ws.send(ION.stringify(err));
          return;
        }

        const message = v.parseSafe(parsed, sidekickIncomingMessageSchema);
        if (message === null) {
          const err: SidekickOutgoingMessage = {
            type: "error",
            error: {
              fault: "client",
              message: "Failed to parse last message as an incoming message. This is a bug in covenant's client code.",
              params: {},
              channel: "unknown",
            },
          };
          ws.send(ION.stringify(err));
          return;
        }

        const client: SidekickClient = {
          subscribe(topic: string) {
            ws.subscribe(topic);
          },
          unsubscribe(topic: string) {
            ws.unsubscribe(topic);
          },
          getId() {
            return ws.data.id;
          },
          directMessage(msg: SidekickOutgoingMessage) {
            ws.send(ION.stringify(msg));
          },
        };

        await sidekick.handleClientMessage(client, message);
      },
      close(_ws) {},
    };
  }
}
