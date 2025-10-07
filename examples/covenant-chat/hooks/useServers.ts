import { api } from "@/client/api";


export function useJoinedServers() {
  return api.useCachedQuery("getJoinedServers", undefined);
}
