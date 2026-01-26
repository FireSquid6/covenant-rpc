import type { AsyncHook } from ".";
import { useEffect, useState } from "react";
// definition for AsyncHook:
// export type AsyncHook<T> = {
//   loading: true,
//   data: null,
//   error: null,
// } | {
//   loading: false,
//   data: T,
//   error: null,
// } | {
//   loading: false,
//   data: null,
//   error: ReactProcedureError,
// }


export type CallbackFunction<T> = () => T;


// useDataStream is best described by an example. Let's say we have a chatFunction which has two methods:
//
// getCurrentMessages: () => Promise<Message[]>
// connectToUpdates: (onUpdate: () => Message): Promise<void> 
// disconnect: () => void
//
// We want to fetch all messages as well as continue to listen to them. useDataStream should handle this
// as well as various race conditions

export function useDataStream<T>({ initialFetch, connect, disconnect }: {
  initialFetch: () => Promise<T[]>,
  connect: (callback: CallbackFunction<T>) => Promise<void>,
  disconnect: () => void
}): AsyncHook<T[]> {
  const [state, setState] = useState<AsyncHook<T[]>>({
    loading: true,
    data: null,
    error: null
  });

  useEffect(() => {
    let isMounted = true;
    let items: T[] = [];
    let isConnecting = false;

    const handleNewItem = (newItem: T) => {
      if (!isMounted) return;

      // Add new item to the list
      items = [...items, newItem];
      setState({
        loading: false,
        data: items,
        error: null
      });
    };

    const initialize = async () => {
      try {
        // Fetch initial data first
        const initialData = await initialFetch();

        if (!isMounted) return;

        items = initialData;
        setState({
          loading: false,
          data: items,
          error: null
        });

        // Connect to updates
        // Note: The type signature indicates CallbackFunction<T> = () => T,
        // but the practical use case requires (newItem: T) => void
        // Using type assertion to work with the expected runtime behavior
        isConnecting = true;
        await connect(handleNewItem as any);

      } catch (error) {
        if (!isMounted) return;

        setState({
          loading: false,
          data: null,
          error: {
            code: 500,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (isConnecting) {
        disconnect();
      }
    };
  }, [initialFetch, connect, disconnect]);

  return state;
}
