import type { CovenantRequest } from "./request";


export type Fetcher = (req: CovenantRequest) => Promise<Response>;



// TODO - allow user to set headers that are always set
export function httpFetcher(url: string): Fetcher {
  return (req: CovenantRequest) => {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req)
    })
  }
}



