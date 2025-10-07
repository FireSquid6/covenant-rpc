import { api } from "@/client/api";


export function useJoinedServers() {
  return api.useCachedQuery("getJoinedServers", undefined);
}

export function useServerChannels(serverId: string) {
  const state = api.useCachedQuery("getServer", {
    serverId: serverId,
  });

  return state;
}
