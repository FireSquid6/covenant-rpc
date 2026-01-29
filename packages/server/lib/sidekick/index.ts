import type { ChannelConnectionPayload, ServerMessage } from "@covenant-rpc/core/channel";
import type { SidekickToServerConnection } from "@covenant-rpc/core/interfaces";
import { httpSidekickToServer } from "../interfaces/http";
import type { LoggerLevel } from "@covenant-rpc/core/logger";
import { Logger } from "../logger";
import { handleListenMessage, handleSendMessage, handleSubscribeMessage, handleUnlistenMessage, handleUnsubscribeMessage, type SidekickHandlerContext } from "./handlers";
import { getChannelTopicName, getResourceTopicName, type SidekickIncomingMessage, type SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";

export interface SidekickClient {
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  getId(): string;
  directMessage(message: SidekickOutgoingMessage): void;
}

export interface SidekickState {
  contextMap: Map<string, unknown>;
  tokenMap: Map<string, ChannelConnectionPayload>;
  usedTokenMap: Map<string, {
    channel: string;
    params: Record<string, string>
    id: string;
  }>
  serverConnection: SidekickToServerConnection;
}

export type PublishFunction = (topic: string, message: SidekickOutgoingMessage) => Promise<void>;


export class Sidekick {
  private publish: PublishFunction;
  private state: SidekickState = {
    contextMap: new Map(),
    tokenMap: new Map(),
    usedTokenMap: new Map(),
    serverConnection: httpSidekickToServer("", ""),
  };
  private logger: Logger;

  constructor(publishFunction: PublishFunction, logLevel?: LoggerLevel) {
    this.publish = publishFunction
    this.logger = new Logger(logLevel ?? "info", [
      () => new Date().toUTCString(),
    ]);
  }

  async updateResources(resources: string[]) {
    const promises: (() => Promise<void>)[] = [];

    for (const r of resources) {
      promises.push(async () => {
        const topic = getResourceTopicName(r);
        await this.publish(topic, {
          type: "updated",
          resource: r,
        });

      });
    }

    await Promise.all(promises.map(p => p()));
  }

  async postServerMessage(message: ServerMessage) {
    const topic = getChannelTopicName(message.channel, message.params);
    await this.publish(topic, {
      type: "message",
      ...message
    });
  }

  addConnection(payload: ChannelConnectionPayload) {
    this.state.tokenMap.set(payload.token, payload);
  }

  async handleClientMessage(client: SidekickClient, message: SidekickIncomingMessage) {
    const logger = this.logger.clone()
      .pushPrefix(`Client: ${client.getId()}`)
      .pushPrefix(`Type: ${message.type}`)
    
    const ctx: SidekickHandlerContext = {
      client,
      logger,
      state: this.state,
      publish: this.publish,
    }
  
    switch (message.type) {
      case "unsubscribe":
        await handleUnsubscribeMessage(message, ctx);
        break;
      case "subscribe":
        await handleSubscribeMessage(message, ctx);
        break;
      case "listen":
        await handleListenMessage(message, ctx);
        break;
      case "unlisten":
        await handleUnlistenMessage(message, ctx);
        break;
      case "send":
        await handleSendMessage(message, ctx);
        break;
    }
  }
}

export type UpdateListener = (resources: string[]) => Promise<void> | void;

