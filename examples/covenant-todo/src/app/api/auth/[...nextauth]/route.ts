import { nextAuthConfig } from "@/lib/auth";
import NextAuth from "next-auth";

const provider = NextAuth(nextAuthConfig);

export { provider as GET, provider as POST}
