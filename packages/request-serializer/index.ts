import { z } from 'zod';

export const serializedRequestSchema = z.object({
  url: z.string(),
  method: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string().optional(),
  bodyType: z.enum(['text', 'json', 'formdata', 'arraybuffer', 'blob']).optional()
});

export type SerializedRequest = z.infer<typeof serializedRequestSchema>;

export async function serializeRequest(request: Request): Promise<SerializedRequest> {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }

  let body: string | undefined;
  let bodyType: SerializedRequest['bodyType'];

  if (request.body) {
    const clonedRequest = request.clone();
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = await clonedRequest.text();
      bodyType = 'json';
    } else if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
      body = await clonedRequest.text();
      bodyType = 'formdata';
    } else if (contentType?.includes('application/octet-stream')) {
      const arrayBuffer = await clonedRequest.arrayBuffer();
      body = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      bodyType = 'arraybuffer';
    } else {
      body = await clonedRequest.text();
      bodyType = 'text';
    }
  }

  return {
    url: request.url,
    method: request.method,
    headers,
    body,
    bodyType
  };
}

export function deserializeRequest(serialized: SerializedRequest): Request {
  const validated = serializedRequestSchema.parse(serialized);
  const { url, method, headers, body, bodyType } = validated;

  let requestBody: Bun.BodyInit | undefined;

  if (body) {
    switch (bodyType) {
      case 'json':
        requestBody = body;
        break;
      case 'formdata':
        requestBody = body;
        break;
      case 'arraybuffer':
        const binaryString = atob(body);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        requestBody = bytes.buffer;
        break;
      case 'text':
      default:
        requestBody = body;
        break;
    }
  }

  return new Request(url, {
    method,
    headers,
    body: requestBody
  });
}
