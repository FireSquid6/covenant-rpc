import { crpc } from "./schema";


const res = await crpc("findUser", {
  username: "hello!",
})
