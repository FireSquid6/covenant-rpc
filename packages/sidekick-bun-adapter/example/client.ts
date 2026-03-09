import { CovenantClient, httpClientToServer, httpClientToSidekick } from "@covenant-rpc/client";
import { covenant } from "./shared";

const channelId = process.argv[2] ?? "general";
const username = process.argv[3] ?? "anonymous";
const password = process.argv[4] ?? "open-sesame";

const client = new CovenantClient(covenant, {
  serverConnection: httpClientToServer("http://localhost:6739/api/covenant", {}),
  sidekickConnection: httpClientToSidekick("http://localhost:6739"),
});

const params = { channelId };
const connResult = await client.connect("chatChannel", params, { password, username });

if (!connResult.success) {
  console.error(`Failed to connect: ${connResult.error?.message}`);
  process.exit(1);
}

console.log(`Connected to #${channelId} as "${username}". Ctrl+C to quit.`);
console.log("─".repeat(50));

await client.subscribe("chatChannel", params, connResult.token!, (msg) => {
  // Clear the current input prompt line, print the message, reprint prompt
  process.stdout.write("\r\x1b[K");
  console.log(`[${msg.sender}]: ${msg.content}`);
  process.stdout.write("> ");
});

process.stdout.write("> ");

for await (const line of console) {
  const content = line.trim();
  if (content) {
    await client.send("chatChannel", params, connResult.token!, { content });
  }
  process.stdout.write("> ");
}
