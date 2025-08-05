import { covenant } from "./schema"
import { CovenantClient } from "../lib/client"
import { httpFetcher } from "../lib/client"

export const crpc = new CovenantClient(covenant.getSchema(), httpFetcher("http://localhost:4200/api"))

const res = await crpc.fetch("findUser", {
  username: "Jonathan"
})

console.log(res);

if (res.status === "ERROR") {
  throw new Error("Rats! I got an error!");
}

const user = res.data[0]!;

console.log(`${user.username} has the image ${user.image}`);


