// This is the shared covenant file - both the client and server import this.
//
// In here we define the "covenant" that the client and server agree to. Both
// sides actually validate each other.
//
// Covenant implements standard schema, meaning you can use whatever validation
// libaray you perfer or even a mix of several!
import { z } from "zod";
import { channel, declareCovenant, mutation, query } from "..";

export const userSchema = z.object({
  userId: z.string(),
  username: z.string(),
  age: z.number(),
});

export type User = z.infer<typeof userSchema>;

export const covenant = declareCovenant({
  context: z.object({
    userId: z.string(),
  }),
  data: z.object({
    userId: z.string(),
    socketId: z.string(),
  }),
  channels: {
    chat: channel({

      // the messages that clients can send
      // use a discriminated union if there's multiple types!
      clientMessage: z.object({
        message: z.string(),
      }),

      // this is the message that the server sends back
      serverMessage: z.object({
        sender: z.string(),
        message: z.string(),
      }),

      // when clients first connect, they provide a request to connect.
      // The server uses this to process the connection context, which can
      // be used to store data on who connected
      connectionRequest: z.object({
        username: z.string(),
        password: z.string(),
      }),
      connectionContext: z.object({
        userId: z.string(),
      }),
      // params create multiple channels with the same schema. You
      // could subscribe to multiple
      params: ["chatRoomId"] as const,
    })
  },

  // procedures look like tRPC stuff. They are either queries or mutations,
  // which is mostly just a semanitc thing (although you should really not be
  // mutating in your queries)
  procedures: {
    findUsers: query({
      input: z.undefined(),
      output: z.array(userSchema),
    }),

    createUser: mutation({
      input: userSchema,
      output: z.undefined(),
    })
  }
})
