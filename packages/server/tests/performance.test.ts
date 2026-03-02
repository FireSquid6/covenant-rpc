import { test, expect, describe } from "bun:test";
import { startSidekickServer } from "../sidekick/webserver";
import { WebSocket } from "ws";
import ION from "@covenant-rpc/ion";
import type { SidekickIncomingMessage, SidekickOutgoingMessage } from "@covenant-rpc/core/sidekick/protocol";
import type { Server } from "node:http";

/**
 * Performance test suite for Sidekick server
 *
 * Tests various scaling scenarios to identify performance limits:
 * 1. Maximum concurrent connections
 * 2. Message throughput
 * 3. Broadcast latency
 * 4. Resource invalidation fan-out
 *
 * NOTE: These tests are skipped by default because they:
 * - Take several minutes to run
 * - Consume significant system resources
 * - Are designed for performance analysis, not CI
 *
 * To run these tests:
 * 1. Remove `.skip` from `describe.skip` below
 * 2. Run: bun run test:perf
 * 3. Review results in console output
 *
 * See PERFORMANCE.md for detailed documentation on interpreting results.
 */

const SIDEKICK_PORT = 9876;
const SIDEKICK_SECRET = "test-secret";

interface PerformanceMetrics {
  connections: number;
  messagesPerSecond: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  memoryUsedMB: number;
}

class SidekickTestClient {
  private ws: WebSocket;
  private messageHandlers: ((msg: SidekickOutgoingMessage) => void)[] = [];
  private connected: Promise<void>;

  constructor(port: number) {
    this.ws = new WebSocket(`ws://localhost:${port}/socket`);
    this.connected = new Promise((resolve, reject) => {
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
    });

    this.ws.on("message", (raw) => {
      const msg = ION.parse(raw.toString()) as SidekickOutgoingMessage;
      this.messageHandlers.forEach(handler => handler(msg));
    });
  }

  async waitForConnection() {
    await this.connected;
  }

  send(msg: SidekickIncomingMessage) {
    this.ws.send(ION.stringify(msg));
  }

  onMessage(handler: (msg: SidekickOutgoingMessage) => void) {
    this.messageHandlers.push(handler);
  }

  close() {
    this.ws.close();
  }

  waitForClose(): Promise<void> {
    return new Promise((resolve) => {
      this.ws.on("close", () => resolve());
    });
  }
}

async function createServer(): Promise<Server> {
  return startSidekickServer({
    port: SIDEKICK_PORT,
    secret: SIDEKICK_SECRET,
    serverConnection: {
      async sendMessage() {
        return null;
      },
    },
    authFailureDelayMs: 0, // Disable delay for testing
  });
}

function calculateStats(values: number[]): { avg: number; p95: number; p99: number } {
  if (values.length === 0) return { avg: 0, p95: 0, p99: 0 };

  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    avg,
    p95: sorted[p95Index] || sorted[sorted.length - 1]!,
    p99: sorted[p99Index] || sorted[sorted.length - 1]!,
  };
}

describe.skip("Sidekick Performance Tests", () => {
  let server: Server;

  // Helper to trigger resource update
  async function triggerResourceUpdate(resources: string[]) {
    const response = await fetch(`http://localhost:${SIDEKICK_PORT}/resources`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SIDEKICK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ resources }),
    });
    expect(response.ok).toBe(true);
  }

  test("Connection scaling - measure max concurrent connections", async () => {
    server = await createServer();
    const clients: SidekickTestClient[] = [];
    const connectionCounts: number[] = [];
    const memoryUsage: number[] = [];

    try {
      // Test increasing connection counts
      const testSizes = [10, 50, 100, 500, 1000, 2000, 5000];

      for (const targetSize of testSizes) {
        const startMem = process.memoryUsage().heapUsed / 1024 / 1024;
        const startTime = Date.now();

        // Add connections to reach target size
        while (clients.length < targetSize) {
          const client = new SidekickTestClient(SIDEKICK_PORT);
          await client.waitForConnection();
          clients.push(client);
        }

        const connectionTime = Date.now() - startTime;
        const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryPerConnection = (endMem - startMem) / (targetSize - (clients.length - targetSize));

        connectionCounts.push(targetSize);
        memoryUsage.push(endMem);

        console.log(`✓ ${targetSize} connections established in ${connectionTime}ms`);
        console.log(`  Memory: ${endMem.toFixed(2)}MB total, ${memoryPerConnection.toFixed(3)}MB per connection`);
      }

      console.log("\n📊 Connection Scaling Results:");
      console.log(`   Max tested: ${clients.length} concurrent connections`);
      console.log(`   Total memory: ${memoryUsage[memoryUsage.length - 1]!.toFixed(2)}MB`);

    } finally {
      // Cleanup
      await Promise.all(clients.map(client => {
        client.close();
        return client.waitForClose();
      }));
      server.close();
    }
  }, 120_000);

  test("Message throughput - messages per second", async () => {
    server = await createServer();
    const clientCount = 100;
    const messagesPerClient = 100;
    const clients: SidekickTestClient[] = [];

    try {
      // Setup clients subscribed to different resources
      for (let i = 0; i < clientCount; i++) {
        const client = new SidekickTestClient(SIDEKICK_PORT);
        await client.waitForConnection();
        client.send({
          type: "listen",
          resources: [`resource-${i}`],
        });
        clients.push(client);
      }

      // Wait for all subscriptions
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send messages as fast as possible
      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      for (let i = 0; i < messagesPerClient; i++) {
        for (let j = 0; j < clientCount; j++) {
          promises.push(triggerResourceUpdate([`resource-${j}`]));
        }
      }

      await Promise.all(promises);
      const totalTime = (Date.now() - startTime) / 1000; // seconds
      const totalMessages = clientCount * messagesPerClient;
      const throughput = totalMessages / totalTime;

      console.log("\n📊 Message Throughput Results:");
      console.log(`   Total messages: ${totalMessages}`);
      console.log(`   Total time: ${totalTime.toFixed(2)}s`);
      console.log(`   Throughput: ${throughput.toFixed(2)} messages/second`);

    } finally {
      await Promise.all(clients.map(client => {
        client.close();
        return client.waitForClose();
      }));
      server.close();
    }
  }, 120_000);

  test("Broadcast latency - varying subscriber counts", async () => {
    server = await createServer();
    const testCases = [10, 50, 100, 500, 1000];

    console.log("\n📊 Broadcast Latency Results:");

    for (const subscriberCount of testCases) {
      const clients: SidekickTestClient[] = [];
      const latencies: number[] = [];
      let receivedCount = 0;

      try {
        const receivePromise = new Promise<void>((resolve) => {
          // Setup subscribers all listening to the same resource
          for (let i = 0; i < subscriberCount; i++) {
            const client = new SidekickTestClient(SIDEKICK_PORT);
            clients.push(client);

            client.waitForConnection().then(() => {
              client.send({
                type: "listen",
                resources: ["shared-resource"],
              });

              client.onMessage((msg) => {
                if (msg.type === "updated" && msg.resource === "shared-resource") {
                  const latency = Date.now() - sendTime;
                  latencies.push(latency);
                  receivedCount++;

                  if (receivedCount === subscriberCount) {
                    resolve();
                  }
                }
              });
            });
          }
        });

        // Wait for all connections and subscriptions
        await Promise.all(clients.map(c => c.waitForConnection()));
        await new Promise(resolve => setTimeout(resolve, 200));

        // Broadcast to all subscribers
        const sendTime = Date.now();
        await triggerResourceUpdate(["shared-resource"]);

        // Wait for all to receive
        await receivePromise;

        const stats = calculateStats(latencies);

        console.log(`   ${subscriberCount} subscribers:`);
        console.log(`     Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`     P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`     P99: ${stats.p99.toFixed(2)}ms`);

      } finally {
        await Promise.all(clients.map(client => {
          client.close();
          return client.waitForClose();
        }));
      }
    }

    server.close();
  }, 120_000);

  test("Resource fan-out - many resources, selective invalidation", async () => {
    server = await createServer();
    const clientCount = 1000;
    const resourcesPerClient = 5;
    const clients: SidekickTestClient[] = [];

    try {
      // Each client listens to multiple unique resources
      for (let i = 0; i < clientCount; i++) {
        const client = new SidekickTestClient(SIDEKICK_PORT);
        await client.waitForConnection();

        const resources = Array.from(
          { length: resourcesPerClient },
          (_, j) => `client-${i}-resource-${j}`
        );

        client.send({
          type: "listen",
          resources,
        });

        clients.push(client);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Invalidate resources for a subset of clients
      const targetClients = 100;
      const resourcesToInvalidate = Array.from(
        { length: targetClients * resourcesPerClient },
        (_, i) => {
          const clientId = Math.floor(i / resourcesPerClient);
          const resourceId = i % resourcesPerClient;
          return `client-${clientId}-resource-${resourceId}`;
        }
      );

      const startTime = Date.now();
      await triggerResourceUpdate(resourcesToInvalidate);
      const invalidationTime = Date.now() - startTime;

      console.log("\n📊 Resource Fan-out Results:");
      console.log(`   Total clients: ${clientCount}`);
      console.log(`   Resources per client: ${resourcesPerClient}`);
      console.log(`   Resources invalidated: ${resourcesToInvalidate.length}`);
      console.log(`   Invalidation time: ${invalidationTime}ms`);

    } finally {
      await Promise.all(clients.map(client => {
        client.close();
        return client.waitForClose();
      }));
      server.close();
    }
  }, 120_000);

  test("Baseline performance profile", async () => {
    server = await createServer();

    const connectionCounts = [100, 500, 1000];
    const results: PerformanceMetrics[] = [];

    console.log("\n📊 Baseline Performance Profile:");

    for (const count of connectionCounts) {
      const clients: SidekickTestClient[] = [];
      const latencies: number[] = [];
      let received = 0;

      try {
        const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

        // Setup connections
        const receivePromise = new Promise<void>((resolve) => {
          for (let i = 0; i < count; i++) {
            const client = new SidekickTestClient(SIDEKICK_PORT);
            clients.push(client);

            client.waitForConnection().then(() => {
              client.send({
                type: "listen",
                resources: ["perf-test"],
              });

              client.onMessage((msg) => {
                if (msg.type === "updated") {
                  const latency = Date.now() - sendTime;
                  latencies.push(latency);
                  received++;
                  if (received === count) resolve();
                }
              });
            });
          }
        });

        await Promise.all(clients.map(c => c.waitForConnection()));
        await new Promise(resolve => setTimeout(resolve, 200));

        const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

        // Measure throughput
        const messageCount = 50;
        const throughputStart = Date.now();

        for (let i = 0; i < messageCount; i++) {
          await triggerResourceUpdate([`throughput-${i}`]);
        }

        const throughputTime = (Date.now() - throughputStart) / 1000;
        const messagesPerSecond = messageCount / throughputTime;

        // Measure broadcast latency
        const sendTime = Date.now();
        await triggerResourceUpdate(["perf-test"]);
        await receivePromise;

        const stats = calculateStats(latencies);

        const metrics: PerformanceMetrics = {
          connections: count,
          messagesPerSecond,
          avgLatencyMs: stats.avg,
          p95LatencyMs: stats.p95,
          p99LatencyMs: stats.p99,
          memoryUsedMB: endMem,
        };

        results.push(metrics);

        console.log(`\n   ${count} connections:`);
        console.log(`     Throughput: ${messagesPerSecond.toFixed(2)} msg/s`);
        console.log(`     Latency (avg): ${stats.avg.toFixed(2)}ms`);
        console.log(`     Latency (p95): ${stats.p95.toFixed(2)}ms`);
        console.log(`     Latency (p99): ${stats.p99.toFixed(2)}ms`);
        console.log(`     Memory: ${endMem.toFixed(2)}MB`);

      } finally {
        await Promise.all(clients.map(client => {
          client.close();
          return client.waitForClose();
        }));
      }
    }

    server.close();

    // Analysis
    console.log("\n📈 Performance Trends:");
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const curr = results[i]!;
      const connMultiplier = curr.connections / prev.connections;
      const latencyMultiplier = curr.avgLatencyMs / prev.avgLatencyMs;

      console.log(`   ${prev.connections} → ${curr.connections} connections:`);
      console.log(`     Latency increased ${latencyMultiplier.toFixed(2)}x (${connMultiplier.toFixed(2)}x connections)`);

      if (latencyMultiplier > connMultiplier * 1.5) {
        console.log(`     ⚠️  Non-linear degradation detected`);
      }
    }
  }, 180_000);
});
