import { connectionRequest, untypedServerMessageSchema } from "covenant/channels";
import { z } from "zod";

export const subscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  connectionRequest: connectionRequest,
});
export type SubscribeMessage = z.infer<typeof subscribeMessageSchema>;

export const unsubscribeMessageSchema = z.object({
  type: z.literal("unsubscribe"),
  channel: z.string(),
  params: z.record(z.string(), z.string()),
});
export type UnsubscribeMessage = z.infer<typeof unsubscribeMessageSchema>;

export const messageSchema = z.object({
  type: z.literal("message"),
  channel: z.string(),
  params: z.record(z.string(), z.string()),
  message: z.any(),
});
export type ChannelMessage = z.infer<typeof messageSchema>;

export const listenMessageSchema = z.object({
  type: z.literal("listen"),
  resources: z.array(z.string()),
});
export type ListenMessage = z.infer<typeof listenMessageSchema>;

export const unlistenMessageSchema = z.object({
  type: z.literal("unlisten"),
  resources: z.array(z.string()),
});
export type UnlistenMessage = z.infer<typeof unlistenMessageSchema>;

export const incomingMessageSchema = z.discriminatedUnion("type", [
  subscribeMessageSchema,
  unsubscribeMessageSchema,
  messageSchema,
  listenMessageSchema,
  unlistenMessageSchema,
]);
export type IncomingMessage = z.infer<typeof incomingMessageSchema>;


export const outgoingMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    data: untypedServerMessageSchema,
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("subscribed"),
    channel: z.string(),
    params: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal("unsubscribed"),
    channel: z.string(),
    params: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal("listening"),
    resources: z.array(z.string()),
  }),
  z.object({
    type: z.literal("unlistening"),
    resources: z.array(z.string()),
  }),
  z.object({
    type: z.literal("updated"),
    resource: z.string(),
  }),
])
  

export type OutgoingMessage = z.infer<typeof outgoingMessageSchema>;

export function makeOutgoing(msg: OutgoingMessage): string {
  return JSON.stringify(msg);
}

export function makeIncoming(msg: IncomingMessage): string {
  return JSON.stringify(msg);
}
