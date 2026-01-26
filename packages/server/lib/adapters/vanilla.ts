import type { CovenantServer } from "../server";

export function vanillaAdapter(server: CovenantServer<any, any, any, any>) {
  return async (request: Request) => {
    const res = await server.handle(request);
    return res;
  }
}

