import { test, expect, describe, beforeAll } from "bun:test";
import { startCovenant } from "./server";
import { startSidekick } from "./sidekick";
import { getNewClient } from "./client";
import { type Server } from "node:http";


describe("covenant rpc e2e test", () => {
  let server: Bun.Server<undefined>; 
  let sidekick: Server

  beforeAll(() => {
    server = startCovenant();
    sidekick = startSidekick(); 
  });

  test("Simple procedure response", async () => {
    const client = getNewClient();
    const res = await client.query("helloWorld", "TestClient");

    expect(res.resources).toEqual([]);
    expect(res.error).toBe(null);
    expect(res.success).toBe(true);
    expect(res.data).toBe("Hello, TestClient");
  });


  test("Listening client receives update when another client mutates", async () => {
    const aClient = getNewClient();
    const bClient = getNewClient();

    let callCount = 0;
    let resolveUpdate: () => void;
    const updateReceived = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });

    const unlisten = aClient.listen(
      "getData",
      "test-key",
      (result) => {
        callCount++;
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ str: "got data: test-key", n: 42 });
        if (callCount >= 2) {
          resolveUpdate();
        }
      },
      true, // remote: register with Sidekick for cross-client notifications
    );

    // Wait for the initial fetch and WebSocket connection to Sidekick to establish
    await new Promise((resolve) => setTimeout(resolve, 200));

    // bClient mutates, which should notify Sidekick, which broadcasts to aClient
    await bClient.mutate("updateData", "test-key");

    // Wait for the update notification to arrive and trigger aClient's callback
    await Promise.race([
      updateReceived,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: aClient did not receive update")), 3000),
      ),
    ]);

    expect(callCount).toBeGreaterThanOrEqual(2);
    unlisten();
  });

  test("Procedure returns an error", async () => {
    const client = getNewClient();

    const successRes = await client.query("failingQuery", false);
    expect(successRes.success).toBe(true);
    expect(successRes.error).toBe(null);
    expect(successRes.data).toBe("success");

    const errorRes = await client.query("failingQuery", true);
    expect(errorRes.success).toBe(false);
    expect(errorRes.data).toBe(null);
    expect(errorRes.resources).toBe(null);
    expect(errorRes.error).toEqual({ message: "Intentional failure", code: 400 });
  });

  test("Query result includes correct resources", async () => {
    const client = getNewClient();

    const res = await client.query("getData", "my-key");

    expect(res.success).toBe(true);
    expect(res.resources).toEqual(["/data/my-key"]);
  });

  test("Input validation failure returns a structured error", async () => {
    const client = getNewClient();

    // Cast to any to bypass TypeScript and send invalid input to the server
    const res = await client.query("getData", 12345 as any);

    expect(res.success).toBe(false);
    expect(res.data).toBe(null);
    expect(res.resources).toBe(null);
    expect(res.error?.code).toBe(404);
    expect(res.error?.message).toMatch(/Error parsing procedure inputs/);
  });

  test("Multiple listeners on the same resource all receive the update", async () => {
    const aClient = getNewClient();
    const bClient = getNewClient();
    const cClient = getNewClient();

    let aCount = 0;
    let bCount = 0;
    let resolveA: () => void;
    let resolveB: () => void;
    const aUpdated = new Promise<void>((resolve) => { resolveA = resolve; });
    const bUpdated = new Promise<void>((resolve) => { resolveB = resolve; });

    const unlistenA = aClient.listen("getData", "shared-key", () => {
      aCount++;
      if (aCount >= 2) resolveA();
    }, true);

    const unlistenB = bClient.listen("getData", "shared-key", () => {
      bCount++;
      if (bCount >= 2) resolveB();
    }, true);

    // Wait for both initial fetches and Sidekick connections to establish
    await new Promise((resolve) => setTimeout(resolve, 200));

    await cClient.mutate("updateData", "shared-key");

    await Promise.race([
      Promise.all([aUpdated, bUpdated]),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: not all listeners received the update")), 3000),
      ),
    ]);

    expect(aCount).toBeGreaterThanOrEqual(2);
    expect(bCount).toBeGreaterThanOrEqual(2);
    unlistenA();
    unlistenB();
  });

  test("Unlisten stops further updates from being received", async () => {
    const aClient = getNewClient();
    const bClient = getNewClient();

    let callCount = 0;

    const unlisten = aClient.listen("getData", "unlisten-key", () => {
      callCount++;
    }, true);

    // Wait for initial fetch and Sidekick connection
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callCount).toBe(1);

    unlisten();

    await bClient.mutate("updateData", "unlisten-key");

    // Wait to confirm no update arrives after unlisten
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(callCount).toBe(1);
  });

  test("Listening client does not receive update when a different resource is mutated", async () => {
    const aClient = getNewClient();
    const bClient = getNewClient();

    let callCount = 0;

    const unlisten = aClient.listen(
      "getData",
      "key-A",
      () => {
        callCount++;
      },
      true,
    );

    // Wait for initial fetch and Sidekick connection to establish
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callCount).toBe(1);

    // Mutate a different resource (key-B), aClient is only listening to key-A
    await bClient.mutate("updateData", "key-B");

    // Wait to confirm no spurious update arrives for key-A
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(callCount).toBe(1);
    unlisten();
  });
});
