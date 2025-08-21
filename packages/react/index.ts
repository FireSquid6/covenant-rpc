import { CovenantClient } from "covenant/client";
import { type Covenant, type ChannelMap, type ProcedureMap } from "covenant";


export class CovenantReactProvider<
  P extends ProcedureMap,
  C extends ChannelMap
> {
  constructor(covenant: Covenant<P, C, any, any>, client: CovenantClient<P, C, any, any>) {

  }

  useProcedureResult(proc: keyof P, inputs: ) {

  }
}
