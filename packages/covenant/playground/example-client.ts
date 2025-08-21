import { CovenantClient, httpMessenger, SocketRealtimeClient } from "../client";
import { covenant } from "./covenant";


// we assume that on localhost:5001 is the edge function server, and on 5002 is the sidekick server
const client = new CovenantClient(
  covenant,
  httpMessenger({ httpUrl: "http://localhost:5001/api" }),
  new SocketRealtimeClient("ws://localhost:5002/connect")
)

// example query
const { result, data: users, error: usersError } = await client.query("findUsers", undefined)

// could fail - we force the consumer to check. There's also a queryUnsafe function if you're into
// that sort of thing. 
if (result === "OK") {
  console.log(users);
} else {
  console.log(`Error ${usersError}`);
}

// we connect to the general channel and log every new message
//
// react helpers for this kinda stuff (imagine a "useChannel" function) will be coming.
client.connectTo("chat", { chatRoomId: "general" }, {
  username: "firesquid",
  password: "1234Thisisabadpassword",
}, (o) => {
  console.log(`Recieved ${o.message} from ${o.sender}`);
});

// we can also send messages in the channel!
client.sendChannelMessage("chat", { chatRoomId: "general"}, {
  message: "Hello!",
});
