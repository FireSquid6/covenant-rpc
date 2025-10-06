import { api } from "@/client/api";


export function useJoinedServers() {
  return api.useQuery("getJoinedServers", undefined);
}
