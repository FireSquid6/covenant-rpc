import path from "path";
import { callDefaultsInDirectory } from "../lib/utils";
import { covenant } from "./schema";

const directory = path.join(import.meta.dirname, "definitions");
await callDefaultsInDirectory(directory);

covenant.assertDefined();

Bun.serve({
  routes: {
    "/": {
      GET: () => {
        return Response.json({
          message: "Hello, world!",
        });
      }
    },
    "/api": {
      POST: (req: Request) => {
        return covenant.handle(req);
      }
    }
  },
  port: 4200,
});

console.log("Started server on port 4200");
