import { covenantServer } from "@/lib/server";
import { vanillaAdapter } from "covenant/adapters/vanilla";


const handler = vanillaAdapter(covenantServer);

export { handler as GET, handler as POST }; 
