import { covenant } from "@/lib/covenant";
import { emptyRealtimeConnection } from "covenant/realtime";
import { CovenantServer } from "covenant/server";
import path from "path";


export const covenantServer = new CovenantServer(
  covenant,
  {
    contextGenerator: (i) => {
      return undefined;
    },
    derivation: (i) => {
      return {
        forceAuthenticated: () => {

        }
      }
    },
    realtimeConnection: emptyRealtimeConnection(),

  }
)


const dir = path.resolve(process.cwd(), "src", "implementations");
await covenantServer.runDefaultInDirectory(dir);
covenantServer.assertAllDefined();
