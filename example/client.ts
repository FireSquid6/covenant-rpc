import { crpc } from "./schema";


const res = await crpc.fetch("findUser", {
  username: "Jonathan"
})
