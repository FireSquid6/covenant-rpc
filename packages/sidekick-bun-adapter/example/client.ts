import { CovenantClient, httpClientToServer, httpClientToSidekick } from "../../client";
import { covenant } from "./shared";


const client = new CovenantClient(covenant, {
  serverConnection: httpClientToServer("http://localhost:6739/api/covenant", {}),
  sidekickConnection: httpClientToSidekick("http://localhost:6739/sidekick/socket"),
});

const connResult = await client.connect("chatChannel", 
  { channelId: "ch1" },
  { password: "HelloWorld!" },
);

if (!connResult.success) {
  throw new Error("Failed to connect to channel");
}


for await (const line of console) {

}
