import { Covenant } from "../lib";
import { z } from "zod";


export const covenant = new Covenant({
  findUser: {
    input: z.object({
      username: z.string(),
    }),
    output: z.array(z.object({
      username: z.string(),
      image: z.string(),
    }))
  },
  // createUser: {
  //   input: z.object({
  //     username: z.string(),
  //     password: z.string(),
  //   }),
  //   output: z.object({
  //     type: z.union([z.literal("succes"), z.literal("failure")]),
  //   }),
  // }
}, () => {}, null)

