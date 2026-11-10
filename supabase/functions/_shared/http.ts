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
