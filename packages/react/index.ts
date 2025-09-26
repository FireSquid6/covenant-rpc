import type { ProcedureMap, ChannelMap, Covenant } from "@covenant/rpc";
import { CovenantClient, type MutationKey, type QueryKey } from "@covenant/rpc/client";
import type { InferProcedureInputs, InferProcedureOutputs } from "@covenant/rpc/procedure";
import { useEffect, useState } from "react";
import { setSyntheticTrailingComments } from "typescript";


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


export class CovenantReactClient<P extends ProcedureMap, C extends ChannelMap> extends CovenantClient<P, C> {
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

        const response = await this.query(procedureName, inputs);

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
          });
        }
      }
      fn();
    }, [inputs]);

    return state;
  }

  useMutation<Q extends MutationKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): ProcedureHook<InferProcedureOutputs<P[Q]>> {
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

        const response = await this.mutate(procedureName, inputs);

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
          });
        }
      }
      fn();
    }, [inputs]);

    return state;
  }

  useListenedQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): ProcedureHook<InferProcedureOutputs<P[Q]>> {
    const [state, setState] = useState<ProcedureHook<InferProcedureOutputs<P[Q]>>>({
      loading: true,
      data: null,
      error: null,
    });


    useEffect(() => {
       return this.listen(procedureName, inputs, ({ data, error }) => {

         if (error !== null) {
           setState({
             loading: false,
             error: error,
             data: null,
           });
         } else {
           setState({
             loading: false,
             error: null,
             data: data,
           });
         }
      });
    }, [inputs])


    return state;
  }
  

  useLastChannelMessage<C extends ChannelName>(p)
}



