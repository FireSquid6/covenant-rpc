import type { ElysiaWS } from "elysia/ws";
import { type ChannelMessage, type IncomingMessage, type ListenMessage, type OutgoingMessage, type SubscribeMessage, type UnlistenMessage, type UnsubscribeMessage } from ".";
import type { EdgeConnection } from "./connection";

export interface SocketContext {
  contextMap: Map<string, unknown>;
  edgeConnection: EdgeConnection;
  key: string;
}

export async function handleMessage(message: IncomingMessage, ctx: SocketContext, ws: ElysiaWS): Promise<OutgoingMessage | null> {
  switch (message.type) {
    case "subscribe":
      return handleSubscribeMessage(message, ctx, ws);
    case "unsubscribe":
      return handleUnsubscribeMessage(message, ctx, ws);
    case "message":
      handleChannelMessage(message, ctx, ws);
      return null;
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

export async function handleChannelMessage(message: ChannelMessage, ctx: SocketContext, ws: ElysiaWS) {
  const mapId = getMapId(ws.id, getChannelTopicName(message.channel, message.params));
  const context = ctx.contextMap.get(mapId)!;

  const res = await ctx.edgeConnection.sendMessage({
    channel: message.channel,
    params: message.params,
    context,
    key: ctx.key,
    message: message.message
  });

  // TODO: actually handle this error
  if (res !== null) {
    console.log(res);
  }

}


export async function handleSubscribeMessage(message: SubscribeMessage, ctx: SocketContext, ws: ElysiaWS): Promise<OutgoingMessage> {
  const req = message.connectionRequest;
  const res = await ctx.edgeConnection.connectClient(req);

  if (res.type === "ERROR") {
    return {
      type: "error",
      error: `${res.error.cause} error: ${res.error.error}`,
    }
  }

  const topic = getChannelTopicName(req.channel, req.params);
  const mapId = getMapId(ws.id, topic);

  ctx.contextMap.set(mapId, res.context);
  ws.subscribe(topic);

  return {
    type: "subscribed",
    channel: req.channel,
    params: req.params,
  }
}

export async function handleUnsubscribeMessage(message: UnsubscribeMessage, ctx: SocketContext, ws: ElysiaWS): Promise<OutgoingMessage> {
  const topic = getChannelTopicName(message.channel, message.params);
  const mapId = getMapId(ws.id, topic);

  ctx.contextMap.delete(mapId);
  ws.unsubscribe(topic);
  return {
    type: "unsubscribed",
    channel: message.channel,
    params: message.params,
  }
}

export function getResourceTopicName(resource: string) {
  return `resource:${resource}`;
}


export function getChannelTopicName(channel: string, params: Record<string, string>) {
  const map = Object.keys(params).map(k => `${k}:${params[k]}`).join(",");
  return `channel:${channel}/${map}`
}



export function getMapId(wsId: string, topic: string) {
  return `${wsId}@${topic}`;
}
