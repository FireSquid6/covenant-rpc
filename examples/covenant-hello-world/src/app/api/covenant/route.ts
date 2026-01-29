import { handleRequest } from '../../../server/server';

/**
 * Next.js API route handler for Covenant RPC
 *
 * This route handles all Covenant procedure calls from the client.
 * It forwards requests to the CovenantServer which processes them.
 */

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}
