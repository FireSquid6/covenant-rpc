import type { APIRoute } from "astro";
import { server } from "../../lib/server";

export const prerender = false;

export const GET: APIRoute = ({ request }) => server.handle(request);
export const POST: APIRoute = ({ request }) => server.handle(request);
