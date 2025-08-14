import type { ElysiaWS } from "elysia/ws";
import { type IncomingMessage, type ListenMessage, type OutgoingMessage, type UnlistenMessage } from ".";

export interface SocketContext {
}

export function handleMessage(message: IncomingMessage, ctx: SocketContext, ws: ElysiaWS): OutgoingMessage {
  switch (message.type) {
    case "subscribe":
      throw new Error("subscribe not implemented");
    case "unsubscribe":
      throw new Error("unsubscribe not implemented");
    case "message":
      throw new Error("message not implemented");
    case "listen":
      return handleListenMessage(message, ctx, ws);
    case "unlisten":
      return handleUnlistenMessage(message, ctx, ws);
  }
}


export function handleListenMessage(message: ListenMessage, _: SocketContext, ws: ElysiaWS): OutgoingMessage {
  for (const resource of message.resources) {
    ws.subscribe(getResourceTopicName(resource));
  }
  console.log("subscribed to resources");

  return {
    type: "listening",
    resources: message.resources,
  }
}

export function handleUnlistenMessage(message: UnlistenMessage, _: SocketContext, ws: ElysiaWS): OutgoingMessage {
  for (const resource of message.resources) {
    ws.unsubscribe(getResourceTopicName(resource));
  }

  return {
    type: "unlistening",
    resources: message.resources,
  }
}


export function getResourceTopicName(resource: string) {
  return `resource:${resource}`; 
}


export function getChannelTopicName(channel: string, params: Record<string, string>) {
  const map = Object.keys(params).map(k => `${k}:${params[k]}`).join(",");
  return `channel:${channel}/${map}`
}
