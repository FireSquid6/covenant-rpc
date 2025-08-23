import { covenantServer } from "@/lib/server";
import { vanillaAdapter } from "covenant/adapters/vanilla";


export const dynamic = "force-dynamic";

const handler = vanillaAdapter(covenantServer);

export { handler as GET, handler as POST }; 
