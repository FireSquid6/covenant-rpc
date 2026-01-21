import { server } from "../server";
import { defineServerAndChannelProcs, defineChat } from "./channels";



export function defineAll() {
  defineServerAndChannelProcs();
  defineChat();
  server.assertAllDefined();
}

