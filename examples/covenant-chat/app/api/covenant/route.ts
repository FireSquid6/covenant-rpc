import { vanillaAdapter } from "@covenant/rpc/adapters/vanilla";
import { server } from "@/lib/server";
import { defineAll } from "@/lib/definitions";


defineAll();
const handler = vanillaAdapter(server);


export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
