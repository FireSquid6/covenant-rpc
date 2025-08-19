import { CovenantClient, httpMessenger, SocketRealtimeClient } from "../client";
import { covenant } from "./covenant";

async function main() {
  const client = new CovenantClient(
    covenant,
    httpMessenger({ httpUrl: "http://localhost:5001/api" }),
    new SocketRealtimeClient("ws://localhost:5002/connect"),
  )  ;

  for await (const line of console) {
    const s = line.split(":");
    if (s.length !== 2) {
      console.log("bad read");
      continue;
    }

    const command = s[0]!;
    const data = s[1]!.trim();

    switch (command) {
      case "subscribe":
        client.connectTo("events", {
          channelId: "general",
        }, {
          userId: data,
        }, (m) => {
          console.log(`RECIEVED: ${m.sender}: ${m.message}`);
        });

        break;
      case "send":
        client.sendChannelMessage("events", {
          channelId: "general",
        }, {
          message: data,
        });
        break;
    }
  }
}

main();
