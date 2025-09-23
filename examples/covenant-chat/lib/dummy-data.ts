import type { User, Channel } from "./db/schema";

export const dummyUsers: User[] = [
  {
    id: "user-1",
    name: "Alice Johnson",
    email: "alice@example.com",
    emailVerified: true,
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b647?w=150",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "user-2", 
    name: "Bob Smith",
    email: "bob@example.com",
    emailVerified: true,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
    createdAt: new Date("2024-01-16"),
    updatedAt: new Date("2024-01-16"),
  },
  {
    id: "user-3",
    name: "Carol Davis",
    email: "carol@example.com", 
    emailVerified: true,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
    createdAt: new Date("2024-01-17"),
    updatedAt: new Date("2024-01-17"),
  },
];

export const dummyServers = [
  {
    id: "server-1",
    name: "Gaming Hub",
  },
  {
    id: "server-2", 
    name: "Dev Team",
  },
  {
    id: "server-3",
    name: "Study Group",
  },
];

export const dummyChannels: Channel[] = [
  {
    id: "channel-1",
    name: "general",
    serverId: "server-1",
  },
  {
    id: "channel-2",
    name: "gaming-discussion", 
    serverId: "server-1",
  },
  {
    id: "channel-3",
    name: "announcements",
    serverId: "server-1",
  },
  {
    id: "channel-4",
    name: "general",
    serverId: "server-2",
  },
  {
    id: "channel-5",
    name: "code-review",
    serverId: "server-2",
  },
  {
    id: "channel-6",
    name: "random",
    serverId: "server-2",
  },
  {
    id: "channel-7", 
    name: "general",
    serverId: "server-3",
  },
  {
    id: "channel-8",
    name: "homework-help",
    serverId: "server-3",
  },
];

export const dummyMessages = [
  {
    id: "msg-1",
    userId: "user-1",
    channelId: "channel-1",
    content: "Hey everyone! Welcome to the gaming hub!",
  },
  {
    id: "msg-2",
    userId: "user-2", 
    channelId: "channel-1",
    content: "Thanks Alice! Excited to be here.",
  },
  {
    id: "msg-3",
    userId: "user-3",
    channelId: "channel-1", 
    content: "Looking forward to some great discussions!",
  },
  {
    id: "msg-4",
    userId: "user-1",
    channelId: "channel-4",
    content: "Don't forget about our code review session tomorrow.",
  },
  {
    id: "msg-5",
    userId: "user-2",
    channelId: "channel-4",
    content: "I'll have my PR ready for review!",
  },
];