import { handleRequest } from '@/server/server';

/**
 * Next.js API route handler for Covenant RPC
 * Handles all procedure calls from the client
 */
export async function POST(request: Request) {
  return handleRequest(request);
}
