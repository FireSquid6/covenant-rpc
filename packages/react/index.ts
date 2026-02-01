import { useState, useEffect, useCallback, useRef } from "react";
import { CovenantClient, type QueryKey, type MutationKey } from "@covenant-rpc/client";
import type { ChannelMap, Covenant, ProcedureMap } from "@covenant-rpc/core";
import type {
	InferProcedureInputs,
	InferProcedureOutputs,
} from "@covenant-rpc/core/procedure";
import type {
	ClientToServerConnection,
	ClientToSidekickConnection,
} from "@covenant-rpc/core/interfaces";

/**
 * Error type returned by React hooks
 */
export interface ReactProcedureError {
	code: number;
	message: string;
}

/**
 * Async state type returned by hooks
 * Discriminated union representing loading, success, or error states
 */
export type AsyncHook<T> =
	| { loading: true; data: null; error: null }
	| { loading: true; data: T; error: null } // Optimistic update state
	| { loading: false; data: T; error: null }
	| { loading: false; data: null; error: ReactProcedureError }
	| { loading: false; data: null; error: null }; // Idle state (for mutations before execution)

/**
 * Mutation state and execute function
 */
export type MutationHook<TInput, TOutput> = [
	(input: TInput) => Promise<void>,
	AsyncHook<TOutput>,
];

/**
 * Options for optimistic updates
 */
export interface OptimisticUpdateOptions<TInput, TOutput> {
	/**
	 * Generate optimistic data based on mutation input
	 */
	optimisticData?: (input: TInput) => TOutput;
	/**
	 * Called when mutation succeeds
	 */
	onSuccess?: (data: TOutput) => void;
	/**
	 * Called when mutation fails (optimistic update is rolled back)
	 */
	onError?: (error: ReactProcedureError) => void;
}

/**
 * Cache entry for useCachedQuery
 */
interface CacheEntry<T> {
	data: AsyncHook<T>;
	listeners: Set<(data: AsyncHook<T>) => void>;
	unsubscribe?: () => void;
}

/**
 * React client extending CovenantClient with React hooks
 */
export class CovenantReactClient<
	P extends ProcedureMap,
	C extends ChannelMap,
> extends CovenantClient<P, C> {
	private cache = new Map<string, CacheEntry<any>>();

	constructor(
		covenant: Covenant<P, C>,
		connections: {
			serverConnection: ClientToServerConnection;
			sidekickConnection: ClientToSidekickConnection;
		},
	) {
		super(covenant, connections);
	}

	/**
	 * Hook for executing queries
	 * Automatically executes on mount and when inputs change
	 */
	useQuery<Q extends QueryKey<P>>(
		procedure: Q,
		inputs: InferProcedureInputs<P[Q]>,
	): AsyncHook<InferProcedureOutputs<P[Q]>> {
		const [state, setState] = useState<
			AsyncHook<InferProcedureOutputs<P[Q]>>
		>({
			loading: true,
			data: null,
			error: null,
		});

		const isMountedRef = useRef(true);

		useEffect(() => {
			isMountedRef.current = true;
			let cancelled = false;

			setState({ loading: true, data: null, error: null });

			this.query(procedure, inputs).then((result) => {
				if (cancelled || !isMountedRef.current) return;

				if (result.success) {
					setState({ loading: false, data: result.data, error: null });
				} else {
					setState({
						loading: false,
						data: null,
						error: {
							code: result.error.code,
							message: result.error.message,
						},
					});
				}
			});

			return () => {
				cancelled = true;
			};
		}, [procedure, JSON.stringify(inputs)]);

		useEffect(() => {
			return () => {
				isMountedRef.current = false;
			};
		}, []);

		return state;
	}

	/**
	 * Hook for executing mutations
	 * Returns [mutate, state] pattern - mutation is called manually
	 */
	useMutation<M extends MutationKey<P>>(
		procedure: M,
		options?: OptimisticUpdateOptions<
			InferProcedureInputs<P[M]>,
			InferProcedureOutputs<P[M]>
		>,
	): MutationHook<
		InferProcedureInputs<P[M]>,
		InferProcedureOutputs<P[M]>
	> {
		const [state, setState] = useState<
			AsyncHook<InferProcedureOutputs<P[M]>>
		>({
			loading: false,
			data: null,
			error: null,
		});

		const isMountedRef = useRef(true);

		useEffect(() => {
			return () => {
				isMountedRef.current = false;
			};
		}, []);

		const mutate = useCallback(
			async (input: InferProcedureInputs<P[M]>) => {
				// Apply optimistic update if provided
				if (options?.optimisticData) {
					const optimisticData = options.optimisticData(input);
					setState({ loading: true, data: optimisticData, error: null });
				} else {
					setState({ loading: true, data: null, error: null });
				}

				const result = await this.mutate(procedure, input);

				if (!isMountedRef.current) return;

				if (result.success) {
					setState({ loading: false, data: result.data, error: null });
					options?.onSuccess?.(result.data);
				} else {
					const error = {
						code: result.error.code,
						message: result.error.message,
					};
					setState({ loading: false, data: null, error });
					options?.onError?.(error);
				}
			},
			[procedure, options],
		);

		return [mutate, state];
	}

	/**
	 * Hook for queries with automatic refetch on resource invalidation
	 * Uses client.listen() for resource tracking
	 */
	useListenedQuery<Q extends QueryKey<P>>(
		procedure: Q,
		inputs: InferProcedureInputs<P[Q]>,
		remote: boolean = false,
	): AsyncHook<InferProcedureOutputs<P[Q]>> {
		const [state, setState] = useState<
			AsyncHook<InferProcedureOutputs<P[Q]>>
		>({
			loading: true,
			data: null,
			error: null,
		});

		const isMountedRef = useRef(true);

		useEffect(() => {
			isMountedRef.current = true;

			setState({ loading: true, data: null, error: null });

			const unsubscribe = this.listen(
				procedure,
				inputs,
				(result) => {
					if (!isMountedRef.current) return;

					if (result.success) {
						setState({ loading: false, data: result.data, error: null });
					} else {
						setState({
							loading: false,
							data: null,
							error: {
								code: result.error.code,
								message: result.error.message,
							},
						});
					}
				},
				remote,
			);

			return () => {
				unsubscribe();
			};
		}, [procedure, JSON.stringify(inputs), remote]);

		useEffect(() => {
			return () => {
				isMountedRef.current = false;
			};
		}, []);

		return state;
	}

	/**
	 * Hook for cached queries with shared state across component instances
	 * All components using the same procedure+inputs share the same cache entry
	 */
	useCachedQuery<Q extends QueryKey<P>>(
		procedure: Q,
		inputs: InferProcedureInputs<P[Q]>,
		remote: boolean = false,
	): AsyncHook<InferProcedureOutputs<P[Q]>> {
		const cacheKey = this.generateCacheKey(procedure as string, inputs);

		// Get or create cache entry
		if (!this.cache.has(cacheKey)) {
			this.createCachedQuery(procedure, inputs, remote);
		}

		const cacheEntry = this.cache.get(cacheKey)!;

		const [state, setState] = useState<
			AsyncHook<InferProcedureOutputs<P[Q]>>
		>(cacheEntry.data);

		useEffect(() => {
			// Subscribe to cache updates
			const listener = (newData: AsyncHook<InferProcedureOutputs<P[Q]>>) => {
				setState(newData);
			};

			cacheEntry.listeners.add(listener);

			// Update state to current cache value in case it changed
			setState(cacheEntry.data);

			return () => {
				cacheEntry.listeners.delete(listener);

				// Clean up cache entry if no more listeners
				if (cacheEntry.listeners.size === 0) {
					cacheEntry.unsubscribe?.();
					this.cache.delete(cacheKey);
				}
			};
		}, [cacheKey]);

		return state;
	}

	/**
	 * Invalidate a specific cache entry
	 */
	invalidateCache<Q extends QueryKey<P>>(
		procedure: Q,
		inputs: InferProcedureInputs<P[Q]>,
	): void {
		const cacheKey = this.generateCacheKey(procedure as string, inputs);
		const cacheEntry = this.cache.get(cacheKey);

		if (cacheEntry) {
			cacheEntry.unsubscribe?.();
			this.cache.delete(cacheKey);
		}
	}

	/**
	 * Clear all cache entries
	 */
	clearCache(): void {
		for (const [, entry] of this.cache) {
			entry.unsubscribe?.();
		}
		this.cache.clear();
	}

	/**
	 * Generate a cache key from procedure name and inputs
	 */
	private generateCacheKey(procedure: string, inputs: any): string {
		return `${procedure}:${JSON.stringify(inputs)}`;
	}

	/**
	 * Create a new cached query entry with listener
	 */
	private createCachedQuery<Q extends QueryKey<P>>(
		procedure: Q,
		inputs: InferProcedureInputs<P[Q]>,
		remote: boolean,
	): void {
		const cacheKey = this.generateCacheKey(procedure as string, inputs);

		const cacheEntry: CacheEntry<InferProcedureOutputs<P[Q]>> = {
			data: { loading: true, data: null, error: null },
			listeners: new Set(),
		};

		this.cache.set(cacheKey, cacheEntry);

		// Set up listener for automatic refetch
		const unsubscribe = this.listen(
			procedure,
			inputs,
			(result) => {
				const newData: AsyncHook<InferProcedureOutputs<P[Q]>> =
					result.success
						? { loading: false, data: result.data, error: null }
						: {
								loading: false,
								data: null,
								error: {
									code: result.error.code,
									message: result.error.message,
								},
							};

				cacheEntry.data = newData;

				// Notify all listeners
				for (const listener of cacheEntry.listeners) {
					listener(newData);
				}
			},
			remote,
		);

		cacheEntry.unsubscribe = unsubscribe;
	}
}
