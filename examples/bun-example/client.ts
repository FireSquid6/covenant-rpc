import { covenant, port } from "./";
import { CovenantClient, EmptyRealtimeClient, httpMessenger } from "covenant/client";


const client = new CovenantClient(
  covenant,
  httpMessenger({ httpUrl: `http://localhost:${port}/api` }),
  new EmptyRealtimeClient(),
)


const t1 = Date.now();

const res = await client.query("helloWorld", {
  name: "Jonathan",
});

const t2 = Date.now();


console.log(res);
console.log(`Took: ${t2 - t1} milliseconds`);

