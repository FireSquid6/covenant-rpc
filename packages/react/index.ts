import type { ProcedureMap, ChannelMap } from "@covenant-rpc/core";
import { InferChannelServerMessage, type InferChannelConnectionRequest, type InferChannelParams } from "@covenant-rpc/core/channel";
import { CovenantClient, type MutationKey, type QueryKey } from "@covenant-rpc/client";
import type { InferProcedureInputs, InferProcedureOutputs } from "@covenant-rpc/core/procedure";
import { useEffect, useState } from "react";


export interface ReactProcedureError {
  code: number;
  message: string;
}

export type AsyncHook<T> = {
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
  error: ReactProcedureError,
}

type Listener = (k: AsyncHook<any>) => void;


export class CovenantReactClient<P extends ProcedureMap, C extends ChannelMap> extends CovenantClient<P, C> {
  // this is any becuse we have no other choice. You just gotta trust me on this one.
  private cache: Map<string, AsyncHook<any>> = new Map();
  private listenes: Map<string, Listener[]> = new Map();

  useQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): AsyncHook<InferProcedureOutputs<P[Q]>> {
    const [state, setState] = useState<AsyncHook<InferProcedureOutputs<P[Q]>>>({
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

  useMutation<Q extends MutationKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): AsyncHook<InferProcedureOutputs<P[Q]>> {
    const [state, setState] = useState<AsyncHook<InferProcedureOutputs<P[Q]>>>({
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

  useListenedQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): AsyncHook<InferProcedureOutputs<P[Q]>> {
    const [state, setState] = useState<AsyncHook<InferProcedureOutputs<P[Q]>>>({
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

  private createCachedQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>) {
    this.listen(procedureName, inputs, ({ data, error }) => {
      const state: AsyncHook<InferProcedureOutputs<P[Q]>> = error === null ? {
        loading: false,
        error: null,
        data: data
      } : {
        loading: false,
        error: error,
        data: null,
      }
      const key = this.getCacheKey(String(procedureName), inputs);

      const listeners = this.listenes.get(key) ?? [];
      this.cache.set(key, state);

      for (const l of listeners) {
        l(state);
      }
    })
  }

  private getCacheKey(procedureName: string, inputs: any) {
    return `${procedureName}-${JSON.stringify(inputs)}`;
  }

  private addCacheListener(key: string, l: Listener) {
    const current = this.listenes.get(key) ?? [];
    current.push(l);
    this.listenes.set(key, current);
  }
  private removeCacheListener(listener: Listener) {
    for (const [k, v] of this.listenes) {
      if (v.find(l => l === listener) !== undefined) {
        const n = v.filter(l => l !== listener);
        this.listenes.set(k, n);
      }
    }
  }


  useCachedQuery<Q extends QueryKey<P>>(procedureName: Q, inputs: InferProcedureInputs<P[Q]>): AsyncHook<InferProcedureOutputs<P[Q]>> {
    const k = this.getCacheKey(String(procedureName), inputs);
    const [state, setState] = useState<AsyncHook<InferProcedureOutputs<P[Q]>>>(this.cache.has(k) ? this.cache.get(k)! : {
      loading: true,
      data: null,
      error: null,
    });

    useEffect(() => {
      // we have to refetch the key in case inputs changed
      const newKey = this.getCacheKey(String(procedureName), inputs);

      if (!this.cache.has(k)) {
        this.createCachedQuery(procedureName, inputs);
      }
      const l: Listener = (s) => setState(s);

      this.addCacheListener(newKey, l);

      return () => this.removeCacheListener(l);

    }, [setState, inputs]);


    return state;
  }
}



