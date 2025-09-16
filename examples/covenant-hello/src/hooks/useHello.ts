import { covenantClient } from "@/client/api";
import { useEffect, useState } from "react";

export type AsyncHook<T> = {
  data: T,
  error: null,
  loading: false,
} | {
  data: null,
  error: Error,
  loading: false,
} | {
  data: null,
  error: null,
  loading: true,
}

export function useHello(name: string) {
  const [state, setState] = useState<AsyncHook<string>>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    const fn = async () => {
      setState({
        loading: true,
        error: null,
        data: null,
      });

      const res = await covenantClient.query("hello", {
        name,
      });

      if (res.success) {
        setState({
          loading: false,
          error: null,
          data: res.data.message,
        });
      } else {
        setState({
          loading: false,
          error: new Error(`Failed to fetch: ${res.error.code} - ${res.error.message}`),
          data: null,
        });
      }
    }

    fn();
  }, [covenantClient, name])

  return state;
}
