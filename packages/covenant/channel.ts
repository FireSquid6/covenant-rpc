import { v } from "./validation";


export const channelErrorSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  fault: v.union(v.literal("server"), v.literal("client"), v.literal("sidekick")),
  message: v.string(),
});
export type ChannelError = v.Infer<typeof channelErrorSchema>;


// sent from the client to the server
export const channelConnectionRequestSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  data: v.unknown(),
});
export type ChannelConnectionRequest = v.Infer<typeof channelConnectionRequestSchema>;

// sent from the server back to the client to inform of a connection
export const channelConnectionResponseSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  result: v.union(
    v.obj({
      type: v.literal("OK"),
      token: v.string(),
    }),
    v.obj({
      type: v.literal("ERROR"),
      error: channelErrorSchema,
    })
  )
});
export type ChannelConnectionResponse = v.Infer<typeof channelConnectionResponseSchema>;

// sent from the server to the sidekick to inform of a new connection
export const channelConnectionPayload = v.obj({
  token: v.string(),
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  context: v.unknown(),
});



export const serverMessageSchema = v.obj({
  channel: v.string(),
  params: v.record(v.string(), v.string()),
  content: v.unknown(),
});
