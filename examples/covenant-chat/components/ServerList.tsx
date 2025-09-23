"use client";

interface Server {
  id: string;
  name: string;
}

interface ServerListProps {
  servers: Server[];
  selectedServerId?: string;
  onServerSelect: (serverId: string) => void;
}

export default function ServerList({ servers, selectedServerId, onServerSelect }: ServerListProps) {
  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-2">
      {servers.map((server) => (
        <div key={server.id} className="tooltip tooltip-right" data-tip={server.name}>
          <button
            onClick={() => onServerSelect(server.id)}
            className={`
              w-12 h-12 rounded-2xl flex items-center justify-center
              text-white font-semibold text-lg transition-all duration-200
              hover:rounded-xl hover:bg-indigo-500
              ${selectedServerId === server.id 
                ? 'bg-indigo-600 rounded-xl' 
                : 'bg-gray-700 hover:bg-gray-600'
              }
            `}
          >
            {server.name.charAt(0).toUpperCase()}
          </button>
        </div>
      ))}
      
      <div className="w-8 h-0.5 bg-gray-600 my-2 rounded-full"></div>
      
      <div className="tooltip tooltip-right" data-tip="Add Server">
        <button className="w-12 h-12 rounded-2xl bg-gray-700 hover:bg-green-600 hover:rounded-xl transition-all duration-200 flex items-center justify-center text-green-400 hover:text-white text-2xl">
          +
        </button>
      </div>
    </div>
  );
}