import { z } from "zod";

const subscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  channel: z.string(),
  connectionRequest: z.any(),
});

const unsubscribeMessageSchema = z.object({
  type: z.literal("unsubscribe"),
  channel: z.string(),
});

const messageSchema = z.object({
  type: z.literal("message"),
  channel: z.string(),
  message: z.any(),
});

const listenMessageSchema = z.object({
  type: z.literal("listen"),
  resources: z.array(z.string()),
});

const unlistenMessageSchema = z.object({
  type: z.literal("unlisten"),
  resources: z.array(z.string()),
});

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
    channel: z.string(),
    data: z.any(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("subscribed"),
    channel: z.string(),
  }),
  z.object({
    type: z.literal("unsubscribed"),
    channel: z.string(),
  }),
])
  

export type OutgoingMessage = z.infer<typeof outgoingMessageSchema>;
