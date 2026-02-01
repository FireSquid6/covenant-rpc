import { test, expect, beforeEach } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { z } from "zod";
import { declareCovenant, query, mutation } from "@covenant-rpc/core";
import { CovenantServer } from "@covenant-rpc/server";
import { emptyServerToSidekick } from "@covenant-rpc/server/interfaces/empty";
import { directClientToServer } from "@covenant-rpc/server/interfaces/direct";
import { emptyClientToSidekick } from "@covenant-rpc/client";
import { CovenantReactClient } from "../index";
import { JSDOM } from "jsdom";

// Set up JSDOM for React testing
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	url: "http://localhost",
});
global.window = dom.window as any;
global.document = dom.window.document;

// Test data schemas
const userSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string(),
});
type User = z.infer<typeof userSchema>;

const todoSchema = z.object({
	id: z.number(),
	title: z.string(),
	completed: z.boolean(),
});
type Todo = z.infer<typeof todoSchema>;

// Test data stores
let users: User[] = [];
let todos: Todo[] = [];

beforeEach(() => {
	// Reset test data before each test
	users = [
		{ id: 1, name: "Alice", email: "alice@example.com" },
		{ id: 2, name: "Bob", email: "bob@example.com" },
	];
	todos = [
		{ id: 1, title: "Buy milk", completed: false },
		{ id: 2, title: "Walk dog", completed: true },
	];
});

// Covenant declaration
const covenant = declareCovenant({
	procedures: {
		getUsers: query({
			input: z.null(),
			output: z.array(userSchema),
		}),
		getUser: query({
			input: z.object({ id: z.number() }),
			output: userSchema,
		}),
		getTodos: query({
			input: z.null(),
			output: z.array(todoSchema),
		}),
		addTodo: mutation({
			input: z.object({ title: z.string() }),
			output: todoSchema,
		}),
		updateTodo: mutation({
			input: todoSchema,
			output: todoSchema,
		}),
		deleteTodo: mutation({
			input: z.object({ id: z.number() }),
			output: z.null(),
		}),
		failingQuery: query({
			input: z.null(),
			output: z.string(),
		}),
	},
	channels: {},
});

// Helper to create test client
function createTestClient() {
	const server = new CovenantServer(covenant, {
		contextGenerator: () => null,
		derivation: () => {},
		sidekickConnection: emptyServerToSidekick(),
	});

	// Define procedures
	server.defineProcedure("getUsers", {
		resources: () => ["users"],
		procedure: () => users,
	});

	server.defineProcedure("getUser", {
		resources: ({ inputs }) => [`user/${inputs.id}`],
		procedure: ({ inputs }) => {
			const user = users.find((u) => u.id === inputs.id);
			if (!user) throw new Error("User not found");
			return user;
		},
	});

	server.defineProcedure("getTodos", {
		resources: () => ["todos"],
		procedure: () => todos,
	});

	server.defineProcedure("addTodo", {
		resources: () => ["todos"],
		procedure: ({ inputs }) => {
			const newTodo = {
				id: todos.length + 1,
				title: inputs.title,
				completed: false,
			};
			todos.push(newTodo);
			return newTodo;
		},
	});

	server.defineProcedure("updateTodo", {
		resources: ({ inputs }) => ["todos", `todo/${inputs.id}`],
		procedure: ({ inputs }) => {
			const index = todos.findIndex((t) => t.id === inputs.id);
			if (index === -1) throw new Error("Todo not found");
			todos[index] = inputs;
			return inputs;
		},
	});

	server.defineProcedure("deleteTodo", {
		resources: ({ inputs }) => ["todos", `todo/${inputs.id}`],
		procedure: ({ inputs }) => {
			todos = todos.filter((t) => t.id !== inputs.id);
			return null;
		},
	});

	server.defineProcedure("failingQuery", {
		resources: () => [],
		procedure: () => {
			throw new Error("Something went wrong");
		},
	});

	server.assertAllDefined();

	return new CovenantReactClient(covenant, {
		sidekickConnection: emptyClientToSidekick(),
		serverConnection: directClientToServer(server, {}),
	});
}

test("useQuery - successfully fetches data", async () => {
	const client = createTestClient();

	const { result } = renderHook(() => client.useQuery("getUsers", null));

	// Initially loading
	expect(result.current.loading).toBe(true);
	expect(result.current.data).toBe(null);
	expect(result.current.error).toBe(null);

	// Wait for data to load
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	expect(result.current.data).toEqual(users);
	expect(result.current.error).toBe(null);
});

test("useQuery - handles errors", async () => {
	const client = createTestClient();

	const { result } = renderHook(() =>
		client.useQuery("failingQuery", null),
	);

	// Initially loading
	expect(result.current.loading).toBe(true);

	// Wait for error
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	expect(result.current.data).toBe(null);
	expect(result.current.error).not.toBe(null);
	expect(result.current.error?.message).toContain("Something went wrong");
});

test("useQuery - refetches when inputs change", async () => {
	const client = createTestClient();

	const { result, rerender } = renderHook(
		({ id }) => client.useQuery("getUser", { id }),
		{
			initialProps: { id: 1 },
		},
	);

	// Wait for first user
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	expect(result.current.data?.name).toBe("Alice");

	// Change input to trigger refetch
	rerender({ id: 2 });

	// Should show loading again
	expect(result.current.loading).toBe(true);

	// Wait for second user
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	expect(result.current.data?.name).toBe("Bob");
});

test("useMutation - returns execute function and state", async () => {
	const client = createTestClient();

	const { result } = renderHook(() =>
		client.useMutation("addTodo", undefined),
	);

	const [mutate, state] = result.current;

	// Initially not loading
	expect(state.loading).toBe(false);
	expect(state.data).toBe(null);
	expect(state.error).toBe(null);
	expect(typeof mutate).toBe("function");
});

test("useMutation - executes mutation and updates state", async () => {
	const client = createTestClient();

	const { result } = renderHook(() =>
		client.useMutation("addTodo", undefined),
	);

	const [mutate] = result.current;

	// Execute mutation
	await act(async () => {
		await mutate({ title: "New Todo" });
	});

	// Wait for completion
	await waitFor(() => {
		expect(result.current[1].loading).toBe(false);
	});

	const [, state] = result.current;
	expect(state.data).toEqual({
		id: 3,
		title: "New Todo",
		completed: false,
	});
	expect(state.error).toBe(null);
});

test("useMutation - supports optimistic updates", async () => {
	const client = createTestClient();

	const optimisticTodo = {
		id: 999,
		title: "Optimistic Todo",
		completed: false,
	};

	const { result } = renderHook(() =>
		client.useMutation("addTodo", {
			optimisticData: () => optimisticTodo,
		}),
	);

	const [mutate] = result.current;

	// Start mutation
	act(() => {
		mutate({ title: "Optimistic Todo" });
	});

	// Should immediately show optimistic data while loading
	await waitFor(() => {
		expect(result.current[1].loading).toBe(true);
		expect(result.current[1].data).toEqual(optimisticTodo);
	});

	// Wait for real data
	await waitFor(() => {
		expect(result.current[1].loading).toBe(false);
	});

	// Should have real data now
	const [, state] = result.current;
	expect(state.data?.id).not.toBe(999); // Real ID, not optimistic
	expect(state.data?.title).toBe("Optimistic Todo");
});

test("useMutation - calls onSuccess callback", async () => {
	const client = createTestClient();
	let successData: Todo | null = null;

	const { result } = renderHook(() =>
		client.useMutation("addTodo", {
			onSuccess: (data) => {
				successData = data;
			},
		}),
	);

	const [mutate] = result.current;

	await act(async () => {
		await mutate({ title: "Success Todo" });
	});

	await waitFor(() => {
		expect(successData).not.toBe(null);
	});

  //@ts-ignore
	expect(successData?.title).toBe("Success Todo");
});

test("useMutation - calls onError callback", async () => {
	const client = createTestClient();
	let errorReceived: any = null;

	// Create a client where we can trigger an error
	const server = new CovenantServer(covenant, {
		contextGenerator: () => null,
		derivation: () => {},
		sidekickConnection: emptyServerToSidekick(),
	});

	server.defineProcedure("addTodo", {
		resources: () => ["todos"],
		procedure: () => {
			throw new Error("Failed to add todo");
		},
	});

	const errorClient = new CovenantReactClient(covenant, {
		sidekickConnection: emptyClientToSidekick(),
		serverConnection: directClientToServer(server, {}),
	});

	const { result } = renderHook(() =>
		errorClient.useMutation("addTodo", {
			onError: (error) => {
				errorReceived = error;
			},
		}),
	);

	const [mutate] = result.current;

	await act(async () => {
		await mutate({ title: "Will Fail" });
	});

	await waitFor(() => {
		expect(errorReceived).not.toBe(null);
	});

	expect(errorReceived?.message).toContain("Failed to add todo");
});

test("useListenedQuery - refetches when resources are invalidated", async () => {
	const client = createTestClient();

	// Start listening to todos
	const { result } = renderHook(() =>
		client.useListenedQuery("getTodos", null, false),
	);

	// Wait for initial data
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	expect(result.current.data?.length).toBe(2);

	// Add a todo (which will invalidate "todos" resource)
	await act(async () => {
		await client.mutate("addTodo", { title: "New Todo" });
	});

	// Should automatically refetch and show new todo
	await waitFor(
		() => {
			expect(result.current.data?.length).toBe(3);
		},
		{ timeout: 2000 },
	);

	expect(result.current.data?.some((t) => t.title === "New Todo")).toBe(
		true,
	);
});

test("useCachedQuery - shares cache across components", async () => {
	const client = createTestClient();

	// Render first hook
	const { result: result1 } = renderHook(() =>
		client.useCachedQuery("getTodos", null, false),
	);

	// Wait for data
	await waitFor(() => {
		expect(result1.current.loading).toBe(false);
	});

	expect(result1.current.data?.length).toBe(2);

	// Render second hook with same query
	const { result: result2 } = renderHook(() =>
		client.useCachedQuery("getTodos", null, false),
	);

	// Second hook should immediately have data (from cache)
	await waitFor(() => {
		expect(result2.current.loading).toBe(false);
	});

	expect(result2.current.data?.length).toBe(2);

	// Mutate to trigger refetch
	await act(async () => {
		await client.mutate("addTodo", { title: "Cached Todo" });
	});

	// Both hooks should see the update
	await waitFor(
		() => {
			expect(result1.current.data?.length).toBe(3);
			expect(result2.current.data?.length).toBe(3);
		},
		{ timeout: 2000 },
	);
});

test("useCachedQuery - cleans up cache when no listeners", async () => {
	const client = createTestClient();

	const { result, unmount } = renderHook(() =>
		client.useCachedQuery("getTodos", null, false),
	);

	// Wait for data
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	// Verify cache has entry
	const cacheKey = "getTodos:null";
	expect((client as any).cache.has(cacheKey)).toBe(true);

	// Unmount to remove listener
	unmount();

	// Cache should be cleaned up
	await waitFor(() => {
		expect((client as any).cache.has(cacheKey)).toBe(false);
	});
});

test("invalidateCache - removes specific cache entry", async () => {
	const client = createTestClient();

	const { result } = renderHook(() =>
		client.useCachedQuery("getTodos", null, false),
	);

	// Wait for data
	await waitFor(() => {
		expect(result.current.loading).toBe(false);
	});

	// Invalidate cache
	client.invalidateCache("getTodos", null);

	// Cache should be cleared
	const cacheKey = "getTodos:null";
	expect((client as any).cache.has(cacheKey)).toBe(false);
});

test("clearCache - removes all cache entries", async () => {
	const client = createTestClient();

	// Create multiple cached queries
	const { result: result1 } = renderHook(() =>
		client.useCachedQuery("getTodos", null, false),
	);
	const { result: result2 } = renderHook(() =>
		client.useCachedQuery("getUsers", null, false),
	);

	// Wait for data
	await waitFor(() => {
		expect(result1.current.loading).toBe(false);
		expect(result2.current.loading).toBe(false);
	});

	// Clear all cache
	client.clearCache();

	// All cache entries should be removed
	expect((client as any).cache.size).toBe(0);
});
