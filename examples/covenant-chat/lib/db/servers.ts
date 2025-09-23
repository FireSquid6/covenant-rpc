import { db } from "@/lib/db";
import { serverTable, channelTable, membershipTable } from "./schema";
import { eq, inArray } from "drizzle-orm";
import type { Channel } from "./schema";
import { randomUUID } from "crypto";

export async function getServerWithChannels(serverId: string) {
  const server = await db
    .select()
    .from(serverTable)
    .where(eq(serverTable.id, serverId))
    .limit(1);

  if (server.length === 0) {
    return null;
  }

  const channels = await db
    .select()
    .from(channelTable)
    .where(eq(channelTable.serverId, serverId));

  return {
    server: server[0],
    channels,
  };

}

export async function getUserServersWithChannels(userId: string) {
  const userMemberships = await db
    .select({
      server: serverTable,
    })
    .from(membershipTable)
    .innerJoin(serverTable, eq(membershipTable.serverId, serverTable.id))
    .where(eq(membershipTable.userId, userId));

  if (userMemberships.length === 0) {
    return [];
  }

  const serverIds = userMemberships.map(membership => membership.server.id);
  
  const channels = await db
    .select()
    .from(channelTable)
    .where(inArray(channelTable.serverId, serverIds));

  return userMemberships.map(membership => ({
    server: membership.server,
    channels: channels.filter(channel => channel.serverId === membership.server.id),
  }));
}


export async function createChannel(serverId: string, channelName: string): Promise<Channel> {
  const id = randomUUID();
  
  await db
    .insert(channelTable)
    .values({
      serverId,
      name: channelName,
      id,
    });

  return {
    serverId,
    name: channelName,
    id,
  }
}

export async function deleteChannel(channelId: string) {
  await db
    .delete(channelTable)
    .where(eq(channelTable.id, channelId))
}
