import type { ProcedureMap, ChannelMap, Covenant } from "@covenant/rpc";
import { CovenantClient, type QueryKey } from "@covenant/rpc/client";
import type { InferProcedureInputs, InferProcedureOutputs } from "@covenant/rpc/procedure";
import { useEffect, useState } from "react";


export interface ReactProedureError {
  code: number;
  message: string;
}

export type ProcedureHook<T> = {
  loading: true,
  data: null,
  error: null,
} | {
  loading: false,
  data: T,
  error: null,
} | {
  loading: false,
  data: null,
  error: ReactProedureError,
}


export class CovenantReact<P extends ProcedureMap, C extends ChannelMap> {
  private client: CovenantClient<P, C>

  constructor(client: CovenantClient<P, C>) {
    this.client = client;
  }

  useQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): ProcedureHook<InferProcedureOutputs<P[Q]>> {
    const [state, setState] = useState<ProcedureHook<InferProcedureOutputs<P[Q]>>>({
      loading: true,
      data: null,
      error: null,
    });
    
    useEffect(() => {
      const fn = async () => {
        setState({
          loading: true,
          data: null,
          error: null,
        });

        const response = await this.client.query(procedureName, inputs);

        if (response.success) {
          setState({
            loading: false,
            data: response.data,
            error: null,
          });
        } else {
          setState({
            loading: false,
            data: null,
            error: response.error,
          })

        }

      }
      fn();
    },)

    return state;

  }

}

