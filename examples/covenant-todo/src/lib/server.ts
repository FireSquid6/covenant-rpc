import { covenant } from "@/lib/covenant";
import { emptyRealtimeConnection } from "covenant/realtime";
import { CovenantServer } from "covenant/server";


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

console.log("defining the procedure");
covenantServer.defineProcedure("helloWorld", {
  procedure: ({ inputs }) => {
    return `Hello, ${inputs.name}`;
  },
  resources: () => [],
});


covenantServer.assertAllDefined();


