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
