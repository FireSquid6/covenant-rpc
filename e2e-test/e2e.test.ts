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

  describe("chatroom channel", () => {
    test("subscriber receives message sent by another client", async () => {
      const subscriber = getNewClient();
      const sender = getNewClient();
      const params = { chatChannel: "room-1" };

      const subResult = await subscriber.connect("chatroom", params, { connectionId: 1 });
      expect(subResult.success).toBe(true);

      let resolveMessage: (msg: unknown) => void;
      const messageReceived = new Promise((resolve) => { resolveMessage = resolve; });

      const unsubscribe = await subscriber.subscribe("chatroom", params, subResult.token!, (msg) => {
        resolveMessage(msg);
      });

      const sendResult = await sender.connect("chatroom", params, { connectionId: 2 });
      expect(sendResult.success).toBe(true);

      await sender.send("chatroom", params, sendResult.token!, { message: "hello" });

      const received = await Promise.race([
        messageReceived,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: subscriber did not receive message")), 3000),
        ),
      ]);

      expect(received).toEqual({ senderId: 2, message: "hello" });
      unsubscribe();
    });

    test("clients on different params do not receive each other's messages", async () => {
      const clientA = getNewClient();
      const clientB = getNewClient();
      const paramsA = { chatChannel: "room-A" };
      const paramsB = { chatChannel: "room-B" };

      const connA = await clientA.connect("chatroom", paramsA, { connectionId: 10 });
      const connB = await clientB.connect("chatroom", paramsB, { connectionId: 20 });
      expect(connA.success).toBe(true);
      expect(connB.success).toBe(true);

      let aReceivedCount = 0;
      let bReceivedCount = 0;

      const unsubA = await clientA.subscribe("chatroom", paramsA, connA.token!, () => { aReceivedCount++; });
      const unsubB = await clientB.subscribe("chatroom", paramsB, connB.token!, () => { bReceivedCount++; });

      // clientA sends to room-A; clientB is in room-B and should not receive it
      await clientA.send("chatroom", paramsA, connA.token!, { message: "only for room-A" });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(aReceivedCount).toBe(1); // clientA receives its own broadcast
      expect(bReceivedCount).toBe(0); // clientB receives nothing
      unsubA();
      unsubB();
    });

    test("unsubscribe stops message delivery", async () => {
      const subscriber = getNewClient();
      const sender = getNewClient();
      const params = { chatChannel: "room-unsub" };

      const subConn = await subscriber.connect("chatroom", params, { connectionId: 30 });
      const sendConn = await sender.connect("chatroom", params, { connectionId: 31 });
      expect(subConn.success).toBe(true);
      expect(sendConn.success).toBe(true);

      let receivedCount = 0;
      const unsubscribe = await subscriber.subscribe("chatroom", params, subConn.token!, () => {
        receivedCount++;
      });

      await sender.send("chatroom", params, sendConn.token!, { message: "first" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(receivedCount).toBe(1);

      unsubscribe();

      await sender.send("chatroom", params, sendConn.token!, { message: "second" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(receivedCount).toBe(1); // still 1, second message not received
    });
  });

  // not implemented yet!
  //
  // test("updateAllData wildcard mutation notifies listeners on /data/a and /data/b", async () => {
  //   const aClient = getNewClient();
  //   const bClient = getNewClient();
  //   const mutatingClient = getNewClient();
  //
  //   let aCount = 0;
  //   let bCount = 0;
  //   let resolveA: () => void;
  //   let resolveB: () => void;
  //   const aUpdated = new Promise<void>((resolve) => { resolveA = resolve; });
  //   const bUpdated = new Promise<void>((resolve) => { resolveB = resolve; });
  //
  //   const unlistenA = aClient.listen("getData", "a", () => {
  //     aCount++;
  //     if (aCount >= 2) resolveA();
  //   }, true);
  //
  //   const unlistenB = bClient.listen("getData", "b", () => {
  //     bCount++;
  //     if (bCount >= 2) resolveB();
  //   }, true);
  //
  //   // Wait for initial fetches and Sidekick connections to establish
  //   await new Promise((resolve) => setTimeout(resolve, 200));
  //
  //   // updateAllData returns ["/data/*"], which should match both /data/a and /data/b
  //   await mutatingClient.mutate("updateAllData", null);
  //
  //   await Promise.race([
  //     Promise.all([aUpdated, bUpdated]),
  //     new Promise<void>((_, reject) =>
  //       setTimeout(() => reject(new Error("Timeout: wildcard update did not reach both listeners")), 3000),
  //     ),
  //   ]);
  //
  //   expect(aCount).toBeGreaterThanOrEqual(2);
  //   expect(bCount).toBeGreaterThanOrEqual(2);
  //   unlistenA();
  //   unlistenB();
  // });
});
