import { db } from "@/lib/db";
import { serverTable, channelTable, membershipTable, messageTable, user } from "./schema";
import { eq, inArray, desc } from "drizzle-orm";
import type { Channel, Message } from "./schema";
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

export async function getMessages(channelId: string, limit: number = 100) {
  const messages = await db
    .select({
      message: messageTable,
      user: user,
    })
    .from(messageTable)
    .leftJoin(user, eq(messageTable.userId, user.id))
    .where(eq(messageTable.channelId, channelId))
    .orderBy(desc(messageTable.createdAt))
    .limit(limit);

  return messages.reverse(); // Return oldest first
}

export async function createMessage(channelId: string, userId: string, content: string): Promise<Message> {
  const id = randomUUID();
  const createdAt = new Date();

  await db
    .insert(messageTable)
    .values({
      id,
      channelId,
      userId,
      content,
      createdAt,
    });

  return {
    id,
    channelId,
    userId,
    content,
    createdAt,
  }
}
