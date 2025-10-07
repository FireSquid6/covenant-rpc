import { api } from "@/client/api";


export function useJoinedServers() {
  return api.useListenedQuery("getJoinedServers", undefined);
}
