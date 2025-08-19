import { bunAdapter } from "../adapters/bun";
import { httpRealtimeConnection } from "../realtime";
import { CovenantServer } from "../server";
import { covenant, type User } from "./covenant";

const server = new CovenantServer(covenant, {
  contextGenerator: () => {
    return {
      userId: "example",
    }
  },
  realtimeConnection: httpRealtimeConnection(
    "http://localhost:5002",
    "secret",
  ),
  derivation: () => {
    return {
      logFunction: () => {
        console.log("this function is doing a log!");
      }
    }
  }
})

const users: User[] = [
  {
    userId: "1",
    username: "Joe",
    age: 19,
  },
  {
    userId: "2",
    username: "James",
    age: 21,
  },
]

server.defineProcedure("findUsers", {
  procedure: () => {
    return users;
  },
  resources: () => {
    return ["/users"];
  }
})

server.defineProcedure("createUser", {
  procedure: ({ inputs }) => {
    users.push(inputs);
    return undefined;
  },
  resources: () => {
    return ["/users"];
  }
})

server.defineChannel("events", {
  onConnect(i) {
    return {
      userId: i.inputs.userId,
    }
  },
  // TODO - params are not strongly typed
  onMessage({ params, inputs, context }) {
    server.sendMessage("events", params, {
      sender: context.userId,
      message: inputs.message,
    })
  },
})

server.assertAllDefined();



Bun.serve({
  port: 5001,
  routes: {
    "/api": bunAdapter(server),
  }
});

console.log("Server listening on 5001");
