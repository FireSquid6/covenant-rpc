import type { CovenantServer } from "../server";


export function bunAdapter(server: CovenantServer<any, any, any, any, any>) {
  const fn = (req: Request) => server.handle(req);
  
  return {
    GET: fn,
    POST: fn,
    PUT: fn,
    PATCH: fn,
    DELTE: fn,
  }
}
