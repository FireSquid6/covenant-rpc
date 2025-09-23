import { server } from "../server";
import { defineServerAndChannelProcs } from "./channels";



export function defineAll() {
  defineServerAndChannelProcs();
  server.assertAllDefined();
}

defineAll();

