#!/usr/bin/env bun
import { Command } from "commander";
import { startSidekickServer } from "../sidekick/webserver";

const program = new Command();

program
  .name("covenant-sidekick")
  .description("Standalone WebSocket service for Covenant RPC realtime channels and resource invalidation")
  .version("1.0.0")
  .option("-p, --port <number>", "Port to listen on (env: SIDEKICK_PORT)", process.env.SIDEKICK_PORT || "3000")
  .option("-s, --secret <string>", "Secret key for authentication (env: SIDEKICK_SECRET)", process.env.SIDEKICK_SECRET)
  .option("--auth-delay <milliseconds>", "Delay before responding to failed auth attempts", process.env.SIDEKICK_AUTH_DELAY || "3000")
  .addHelpText("after", `
Environment Variables:
  SIDEKICK_PORT          Port to listen on
  SIDEKICK_SECRET        Secret key for authentication (required)
  SIDEKICK_AUTH_DELAY    Auth failure delay in milliseconds

Examples:
  $ covenant-sidekick --port 8080 --secret my-secret-key
  $ SIDEKICK_SECRET=my-key covenant-sidekick --port 3001
  $ bunx @covenant-rpc/server covenant-sidekick --secret my-key
  `)
  .action((options) => {
    const port = parseInt(options.port);
    const secret = options.secret;
    const authFailureDelayMs = parseInt(options.authDelay);

    // Validate port
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error("Error: --port must be a valid port number (1-65535)");
      process.exit(1);
    }

    // Validate secret
    if (!secret) {
      console.error("Error: Secret key is required. Provide it via --secret or SIDEKICK_SECRET environment variable.");
      process.exit(1);
    }

    // Validate auth delay
    if (isNaN(authFailureDelayMs) || authFailureDelayMs < 0) {
      console.error("Error: --auth-delay must be a non-negative number");
      process.exit(1);
    }

    console.log("Starting Covenant Sidekick Server...");
    console.log(`  Port: ${port}`);
    console.log(`  Auth failure delay: ${authFailureDelayMs}ms`);

    const server = startSidekickServer({
      port,
      secret,
      authFailureDelayMs,
    });

    console.log(`\nSidekick server listening on http://localhost:${port}`);
    console.log(`WebSocket endpoint: ws://localhost:${port}/socket`);
    console.log("\nPress Ctrl+C to stop");

    // Graceful shutdown
    const shutdown = () => {
      console.log("\n\nShutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program.parse();
