import { covenantServer } from "@/procedures";
import { vanillaAdapter } from "covenant/adapters/vanilla";


const handler = vanillaAdapter(covenantServer);

export { handler as GET, handler as POST }; 
