/**
 * Answers of the Edge Functions to the browser. The app calls them from another origin, with the
 * session in the `Authorization` header and never with cookies, so any origin may call.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
};

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...headers },
  });
}

/** A failure the app turns into a `DataError` by its status (`toDataError()`). */
export function failure(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return json(status, { message }, headers);
}

/** The answer to the preflight of the browser. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** The token of the session that calls, from `Authorization: Bearer …`. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '');
  return match ? match[1] : null;
}

/**
 * The largest body a function reads: several times the longest code (`MAX_CODE_LENGTH`) with its
 * exercise, its tests and the data of the queries.
 */
export const MAX_BODY_BYTES = 1_000_000;

/** A body past `MAX_BODY_BYTES`: the handler answers 413 without having read it whole. */
export class BodyTooLargeError extends Error {
  constructor() {
    super('The request is too large');
    this.name = 'BodyTooLargeError';
  }
}

/** What every function answers to a body it did not read whole. */
export function tooLarge(): Response {
  return failure(413, 'The request is too large');
}

/**
 * The body as JSON, or `undefined` if it is not JSON. Whoever calls may send anything, so it is
 * read up to `maxBytes` and no further: by what `Content-Length` says and, as it may lie or be
 * missing, by what actually arrives.
 */
export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    return undefined;
  }
}
