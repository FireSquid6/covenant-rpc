import { CovenantClient } from "covenant/client";
import { type Covenant, type ChannelMap, type ProcedureMap } from "covenant";

// TODO - this will be really smart one day I promise

export class CovenantReactProvider<
  P extends ProcedureMap,
  C extends ChannelMap
> {
  constructor(covenant: Covenant<P, C, any, any>, client: CovenantClient<P, C, any, any>) {

  }

  useProcedureResult<K extends keyof P>(proc: K, inputs: P[K]) {

  }
}
