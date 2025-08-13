import type { CovenantServer } from "../server";


export function vanillaAdapter(server: CovenantServer<any, any, any, any, any>) {
  return (request: Request) => {
    return server.handle(request);
  }
}
