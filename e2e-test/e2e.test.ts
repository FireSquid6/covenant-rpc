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
});
