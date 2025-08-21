import { CovenantClient, EmptyRealtimeClient, httpMessenger } from "covenant/client";
import { covenant } from "./covenant";


export const covenantClient = new CovenantClient(covenant, 
  httpMessenger({ httpUrl: "http://localhost:3000/api" }),
  new EmptyRealtimeClient(),
);
