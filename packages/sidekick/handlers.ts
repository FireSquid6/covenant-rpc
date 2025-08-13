import type { ElysiaWS } from "elysia/ws";
import { makeOutgoing, type IncomingMessage, type ListenMessage, type OutgoingMessage, type UnlistenMessage } from ".";
import type { UpdateListener, Updater } from "./server";

export interface SocketContext {
  listeningMap: Map<string, UpdateListener>;
  updater: Updater;
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


export function handleListenMessage(message: ListenMessage, ctx: SocketContext, ws: ElysiaWS): OutgoingMessage {
  if (!ctx.listeningMap.has(ws.id)) {
    ctx.listeningMap.set(ws.id, (resources) => {
      ws.send(makeOutgoing({
        type: "updated",
        resources,
      }))
    })
  }

  const listener = ctx.listeningMap.get(ws.id)!;
  ctx.updater.listenTo(message.resources, listener);

  return {
    type: "listening",
    resources: message.resources,
  }
}

export function handleUnlistenMessage(message: UnlistenMessage, ctx: SocketContext, ws: ElysiaWS): OutgoingMessage {
  if (!ctx.listeningMap.has(ws.id)) {
    ctx.listeningMap.set(ws.id, (resources) => {
      ws.send(makeOutgoing({
        type: "updated",
        resources,
      }))
    })
  }

  const listener = ctx.listeningMap.get(ws.id)!;
  ctx.updater.unlistenTo(message.resources, listener);
  
  return {
    type: "unlistening",
    resources: message.resources,
  }
}

