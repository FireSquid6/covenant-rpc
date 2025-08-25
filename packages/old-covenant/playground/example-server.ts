import { httpRealtimeConnection } from "../realtime";
import { CovenantServer } from "../server";
import { covenant, type User } from "./covenant";

const server = new CovenantServer(covenant, {
  contextGenerator: () => {
    return {
      userId: "example",
    }
  },
  // this is the connection to the sidekick server
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

// dummy data
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

// we have to indidually define all of what we declared. This can
// be done in different files if we so choose
server.defineProcedure("findUsers", {
  procedure: () => {
    return users;
  },
  // the resource allows us to automatically refetch if a client
  // mutates a specific resource
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

server.defineChannel("chat", {
  onConnect(i) {
    return {
      // dummy data - would actually want to authenticated
      userId: "newId"
    }
  },
  onMessage({ params, inputs, context }) {
    // now we send the message back!
    server.sendMessage("chat", params, {
      sender: context.userId,
      message: inputs.message,
    })
  },
})

// this is crucial - we use this to make sure the server defines everything
server.assertAllDefined();


