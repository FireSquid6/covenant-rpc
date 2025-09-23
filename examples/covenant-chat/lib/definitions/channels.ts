import { server } from "../server";
import { createChannel, deleteChannel, getServerWithChannels, getUserServersWithChannels } from "../db/servers";


export function defineServerAndChannelProcs() {
  server.defineProcedure("getServer", {
    procedure: async ({ inputs, derived, error }) => {
      derived.forceAuthenticated();

      const server = await getServerWithChannels(inputs.serverId);

      if (!server) {
        throw error(`Server ${inputs.serverId} not found`, 404);
      }

      return server;
    },
    resources: ({ outputs }) => {
      const res = [`/servers/${outputs.server.id}`];
      
      for (const c of outputs.channels) {
        res.push(`/channels/${c.id}`);
      }

      return res;
    },
  });

  server.defineProcedure("getJoinedServers", {
    procedure: async ({ derived }) => {
      const { user } = derived.forceAuthenticated();
      const servers = await getUserServersWithChannels(user.id);
      return servers;
    },
    resources: ({ outputs }) => {
      const res = [];
      for (const s of outputs) {
        res.push(`/servers/${s.server.id}`);
        for (const c of s.channels) {
          res.push(`/channels/${c.id}`);
        }
      }
      return res;
    }
  });

  server.defineProcedure("createChannel", {
    procedure: async ({ derived, inputs }) => {
      derived.forceAuthenticated();
      // TODO - ensure user has the authority to do the thing 

      const channel = await createChannel(inputs.serverId, inputs.name);
      return channel;
    },
    resources: ({ outputs }) => [`/channels/${outputs.id}`],
  });

  server.defineProcedure("deleteChannel", {
    procedure: async ({ derived, inputs }) => {
      derived.forceAuthenticated();
      await deleteChannel(inputs.channelId);

      return undefined;
    },
    resources: ({ inputs }) => [`/channels/${inputs.channelId}`],
  });
}
