"use client";

import type { Channel, User } from "@/lib/db/schema";

interface Message {
  id: string;
  userId: string;
  channelId: string;
  content: string;
}

interface ChatAreaProps {
  channel?: Channel;
  messages: Message[];
  users: User[];
}

export default function ChatArea({ channel, messages, users }: ChatAreaProps) {
  if (!channel) {
    return (
      <div className="flex-1 bg-gray-700 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Covenant Chat!</h2>
          <p className="text-gray-300">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  const channelMessages = messages.filter(msg => msg.channelId === channel.id);
  
  const getUserById = (userId: string) => users.find(user => user.id === userId);

  return (
    <div className="flex-1 bg-gray-700 flex flex-col">
      <div className="h-16 border-b border-gray-600 flex items-center px-6">
        <span className="text-gray-400 mr-2">#</span>
        <h2 className="text-white font-semibold text-lg">{channel.name}</h2>
        <div className="flex items-center ml-auto space-x-4">
          <button className="text-gray-400 hover:text-white">📌</button>
          <button className="text-gray-400 hover:text-white">👥</button>
          <button className="text-gray-400 hover:text-white">📞</button>
          <button className="text-gray-400 hover:text-white">🔍</button>
          <button className="text-gray-400 hover:text-white">📥</button>
          <button className="text-gray-400 hover:text-white">❓</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {channelMessages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <h3 className="text-xl font-semibold text-white mb-2">Welcome to #{channel.name}!</h3>
            <p>This is the beginning of the #{channel.name} channel.</p>
          </div>
        ) : (
          channelMessages.map((message) => {
            const user = getUserById(message.userId);
            return (
              <div key={message.id} className="flex items-start space-x-3 hover:bg-gray-600 hover:bg-opacity-30 p-2 rounded">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  {user?.image ? (
                    <img 
                      src={user.image} 
                      alt={user.name} 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-white font-semibold">{user?.name || 'Unknown User'}</span>
                    <span className="text-gray-400 text-xs">Today at 12:00 PM</span>
                  </div>
                  <p className="text-gray-100">{message.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-4">
        <div className="bg-gray-600 rounded-lg px-4 py-3">
          <input
            type="text"
            placeholder={`Message #${channel.name}`}
            className="w-full bg-transparent text-white placeholder-gray-400 outline-none"
          />
        </div>
      </div>
    </div>
  );
}