#!/usr/bin/env bun

import { getSidekickApi } from "../web";

const secret = process.env.SIDEKICK_SECRET;
if (!secret) {
  console.error("Error: SIDEKICK_SECRET environment variable is required");
  process.exit(1);
}

const port = parseInt(process.env.SIDEKICK_PORT ?? "8008");
if (isNaN(port)) {
  console.error(`Error: SIDEKICK_PORT="${process.env.SIDEKICK_PORT}" could not be parsed as a number`);
  process.exit(1);
}

const app = getSidekickApi(secret);

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
