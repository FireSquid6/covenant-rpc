import { CovenantClient, httpMessenger, SocketRealtimeClient } from "../client";
import { covenant } from "./covenant";

async function main() {

  const client = new CovenantClient(
    covenant,
    httpMessenger({ httpUrl: "http://localhost:5001/api" }),
    new SocketRealtimeClient("ws://localhost:5002/connect")
  )

  for await (const line of console) {
    switch (line) {
      case "new":
        console.log("Made new user.");
        const number = Math.floor(Math.random() * 100) + 1;
        await client.mutate("createUser", {
          userId: `id-${number}`,
          username: `user-${number}`,
          age: 20,
        });
        break;
      case "fetch":
        console.log("Fetching new user:");
        const result = await client.query("findUsers", undefined);
        if (result.result === "OK") {
          console.log(result.data);
        } else {
          console.log(`Error: ${result.error}`);
        }
        break;
      default:
        console.log(`Unrecognized: ${line}`);
    }
  }
}


main();
