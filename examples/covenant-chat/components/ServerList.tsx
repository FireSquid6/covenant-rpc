"use client";
import Link from "next/link";
import { useJoinedServers } from "@/hooks/useServers";


function ServerSkeleton() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-base-content/30 animate-pulse"></div>
  );
}

export interface ServersListProps {
  selectedServerId?: string;
}

export function ServerList({ selectedServerId }: ServersListProps) {
  const { data: servers, loading, error } = useJoinedServers();

  if (error) {
    // TODO - better error management
    console.error(error);
  }

  if (loading) {
    return (
      <div className="w-16 bg-base-200 flex flex-col items-center py-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <ServerSkeleton key={index} />
        ))}
        
        <div className="w-8 h-0.5 bg-base-content/30 my-2 rounded-full"></div>
        
        <div className="tooltip tooltip-right" data-tip="Add Server">
          <button className="w-12 h-12 rounded-2xl bg-base-content/30 hover:bg-success hover:rounded-xl transition-all duration-200 flex items-center justify-center text-success hover:text-success-content text-2xl">
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-16 bg-base-200 flex flex-col items-center py-3 gap-2">
      {(servers ?? []).map(({ server }) => (
        <div key={server.id} className="tooltip tooltip-right" data-tip={server.name}>
          <Link
            href={`/servers/${server.id}`}
            className={`
              w-12 h-12 rounded-2xl flex items-center justify-center
              text-base-content font-semibold text-lg transition-all duration-200
              hover:rounded-xl hover:bg-primary
              ${selectedServerId === server.id 
                ? 'bg-primary rounded-xl text-primary-content' 
                : 'bg-base-content/30 hover:bg-base-content/20'
              }
            `}
          >
            {server.name.charAt(0).toUpperCase()}
          </Link>
        </div>
      ))}
      
      <div className="w-8 h-0.5 bg-base-content/30 my-2 rounded-full"></div>
      
      <div className="tooltip tooltip-right" data-tip="Add Server">
        <button className="w-12 h-12 rounded-2xl bg-base-content/30 hover:bg-success hover:rounded-xl transition-all duration-200 flex items-center justify-center text-success hover:text-success-content text-2xl">
          +
        </button>
      </div>
    </div>
  );
}
