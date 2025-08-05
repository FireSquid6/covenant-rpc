import { Covenant } from "../lib";
import { z } from "zod";
import { httpFetcher } from "../lib/client";


const covenant = new Covenant({
  findUser: {
    input: z.object({
      username: z.string(),
    }),
    output: z.array(z.object({
      username: z.string(),
      image: z.string(),
    }))
  }
}, () => {}, null)


covenant.define("findUser", ({ inputs }) => {
  console.log(inputs.username);

  return [
    {
      username: "hello",
      image: "image!",
    }
  ]
})

covenant.assertDefined();

export const crpc = covenant.getClient(httpFetcher("http://localhost:4200/api"))
