import { channelErrorSchema } from "../channel";
import { v } from "../validation";



// tokens are given to the server and the sidekick at the same time
export const subscribeMessageSchema = v.obj({
  type: v.literal("subscribe"),
  token: v.string(),
});
export type SubscribeMessage = v.Infer<typeof subscribeMessageSchema>;

export const unsubscribeMessageSchema = v.obj({
  type: v.literal("unsubscribe"),
  token: v.string(),
});
export type UnsubscribeMessage = v.Infer<typeof unsubscribeMessageSchema>;

export const sendMessageSchema = v.obj({
  type: v.literal("send"),
  token: v.string(),
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  data: v.unknown(),
});
export type SendMessage = v.Infer<typeof sendMessageSchema>;

export const listenMessageSchema = v.obj({
  type: v.literal("listen"),
  resources: v.array(v.string()),
});
export type ListenMessage = v.Infer<typeof listenMessageSchema>;

export const unlistenMessageSchema = v.obj({
  type: v.literal("unlisten"),
  resources: v.array(v.string()),
});
export type UnlistenMessage = v.Infer<typeof unlistenMessageSchema>;

export const sidekickIncomingMessageSchema = v.union(
  subscribeMessageSchema,
  unsubscribeMessageSchema,
  sendMessageSchema,
  listenMessageSchema,
  unlistenMessageSchema,
);
export type SidekickIncomingMessage = v.Infer<typeof sidekickIncomingMessageSchema>;


export const sidekickOutgoingMessageSchema = v.union(
  v.obj({
    type: v.literal("error"),
    error: channelErrorSchema,
  }),
  v.obj({
    type: v.literal("message"),
    channel: v.string(),
    params: v.record(v.string(), v.string()),
    data: v.unknown(),
  }),
  v.obj({
    type: v.literal("updated"),
    resource: v.string(),
  }),
  v.obj({
    type: v.literal("listening"),
    resources: v.array(v.string()),
  }),
  v.obj({
    type: v.literal("unlistening"),
    resources: v.array(v.string()),
  }),
  v.obj({
    type: v.literal("subscribed"),
    channel: v.string(),
    params: v.record(v.string(), v.string()),
  }),
  v.obj({
    type: v.literal("unsubscribed"),
    channel: v.string(),
    params: v.record(v.string(), v.string()),
  }),
  v.obj({
    type: v.literal("listening"),
    channel: v.string(),
    params: v.record(v.string(), v.string()),
  }),
)

export type SidekickOutgoingMessage = v.Infer<typeof sidekickOutgoingMessageSchema>;


export function getChannelTopicName(channel: string, params: Record<string, string>) {
  const map = Object.keys(params).map(k => `${k}:${params[k]}`).join(",");
  return `channel:${channel}/${map}`
}

export function getResourceTopicName(resource: string) {
  return `resource:${resource}`;
}

export function getMapId(wsId: string, topic: string) {
  return `${wsId}@${topic}`;
}
