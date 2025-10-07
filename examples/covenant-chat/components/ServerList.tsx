"use client";
import Link from "next/link";
import { useJoinedServers } from "@/hooks/useServers";
import { usePathname } from "next/navigation";


function ServerSkeleton() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-gray-700 animate-pulse"></div>
  );
}

export function ServerList() {
  const { data: servers, loading, error } = useJoinedServers();
  const pathname = usePathname();
  const split = pathname.split("/");
  const selectedServerId = split[2] ?? "none";

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
        
        <div className="w-8 h-0.5 bg-gray-600 my-2 rounded-full"></div>
        
        <div className="tooltip tooltip-right" data-tip="Add Server">
          <button className="w-12 h-12 rounded-2xl bg-gray-700 hover:bg-green-600 hover:rounded-xl transition-all duration-200 flex items-center justify-center text-green-400 hover:text-white text-2xl">
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
              text-white font-semibold text-lg transition-all duration-200
              hover:rounded-xl hover:bg-indigo-500
              ${selectedServerId === server.id 
                ? 'bg-indigo-600 rounded-xl' 
                : 'bg-gray-700 hover:bg-gray-600'
              }
            `}
          >
            {server.name.charAt(0).toUpperCase()}
          </Link>
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
