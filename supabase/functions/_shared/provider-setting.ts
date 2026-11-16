/**
 * How a provider wants the format of the answer asked: the JSON schema, plain JSON, nothing, or as
 * calls to tools (the answer is the tool `respond`, 2.5e, D-051).
 */
export type ResponseFormatMode = 'json_schema' | 'json_object' | 'none' | 'tools';

/** One model a function can ask: where, which, with which key and how (D-044). */
export interface ModelEndpoint {
  /** Up to the version, without `/chat/completions`. */
  readonly baseUrl: string;
  readonly model: string;
  /** Name of the secret with its key (`AI_API_KEY`…), never the key; null for none (Ollama). */
  readonly keySecret: string | null;
  readonly responseFormat: ResponseFormatMode;
  /** How long it may take to answer; 15 s if the setting says nothing (MODEL_TIMEOUT_MS). */
  readonly timeoutMs?: number;
}

/**
 * The models the administrator chose (`app_setting.ai_provider`): the main one and its fallbacks,
 * in order, of the same provider or of others with the chat API of OpenAI (D-044).
 */
export interface ProviderSetting {
  readonly models: readonly [ModelEndpoint, ...ModelEndpoint[]];
}

/** The secret with the key of the main provider, when the setting names none. */
export const DEFAULT_KEY_SECRET = 'AI_API_KEY';

/**
 * The only secrets the setting may name: `AI_API_KEY`, `AI_GROQ_API_KEY`… An administrator writes
 * the setting, so it must not be a way to send another secret of the function, such as the
 * `service_role`, to a provider.
 */
const KEY_SECRET = /^AI_(?:[A-Z0-9]+_)*API_KEY$/;

const RESPONSE_FORMATS: readonly ResponseFormatMode[] = [
  'json_schema',
  'json_object',
  'none',
  'tools',
];

/**
 * The hosts the functions call without anybody allowing them: the provider of the project. The
 * setting is a row an administrator writes, and the key of the provider travels to its URL: a
 * session of an administrator must not be enough to send that key anywhere else (D-063).
 */
export const DEFAULT_AI_HOSTS: readonly string[] = ['generativelanguage.googleapis.com'];

/**
 * The secret of the functions with the other hosts they may call, separated by commas: whoever
 * sets the keys says where they may go. A host alone (`api.groq.com`) is called by `https`; one by
 * `http`, such as a local model, is written whole (`http://host.docker.internal:11434`).
 */
export const ALLOWED_HOSTS_SECRET = 'AI_ALLOWED_HOSTS';

/** How many fallbacks a setting may have, as its check in the table: each one is one more call. */
export const MAX_FALLBACKS = 5;

/**
 * Whether the functions may call a base URL: a URL of the web without credentials whose origin is
 * that of a default host or of one of `extra` (the value of `AI_ALLOWED_HOSTS`).
 */
export function allowedHosts(extra = ''): (baseUrl: string) => boolean {
  const origins = new Set(
    [...DEFAULT_AI_HOSTS, ...extra.split(',')].flatMap((entry) => {
      const url = urlOf(entry.includes('://') ? entry.trim() : `https://${entry.trim()}`);
      return url ? [url.origin] : [];
    }),
  );
  return (baseUrl) => {
    const url = urlOf(baseUrl);
    return (
      url !== null &&
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.username === '' &&
      url.password === '' &&
      origins.has(url.origin)
    );
  };
}

function urlOf(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/** The limits of the time a model of the setting may take to answer (`timeoutMs`). */
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;

/**
 * The models of `app_setting.ai_provider`, which an administrator writes as JSON (D-044):
 *
 * ```json
 * { "baseUrl": "…/openai", "model": "gemini-3.5-flash-lite",
 *   "fallbacks": ["gemini-x", { "baseUrl": "https://api.groq.com/openai/v1", "model": "llama-…",
 *                               "keySecret": "AI_GROQ_API_KEY", "responseFormat": "json_object" }] }
 * ```
 *
 * The main model needs a base URL and a model; `null` otherwise. A fallback is the name of another
 * model of the same provider, or an object with its own base URL, the name of its secret and its
 * response format, and any model may set the time it may take (`timeoutMs`, 15 s by default: a
 * local model may need more). A fallback of another base URL never inherits the key of the main one, which
 * would hand it to another provider: without `keySecret`, it goes without a key. What is not a
 * valid model, a repeated one or the main one itself is left out, and so is a model of a host the
 * functions may not call (`mayCall`, `allowedHosts()`): with the main one there, there is no
 * provider. Only the first `MAX_FALLBACKS` fallbacks count.
 */
export function providerSettingOf(
  value: unknown,
  mayCall: (baseUrl: string) => boolean = allowedHosts(),
): ProviderSetting | null {
  if (!isRecord(value)) return null;
  const allowed = (endpoint: ModelEndpoint | null): ModelEndpoint | null => {
    if (!endpoint || mayCall(endpoint.baseUrl)) return endpoint;
    // The host is no secret, and whoever wrote the setting needs to know why it does not work
    console.warn(`The AI provider setting names a host that is not allowed: ${endpoint.baseUrl}`);
    return null;
  };
  const main = allowed(endpointOf(value, null));
  if (!main) return null;
  const fallbacks = (Array.isArray(value.fallbacks) ? value.fallbacks : []).flatMap((entry) => {
    const endpoint = allowed(
      endpointOf(typeof entry === 'string' ? { model: entry } : entry, main),
    );
    return endpoint ? [endpoint] : [];
  });
  const seen = new Set<string>();
  const models = [main, ...fallbacks].filter((endpoint) => {
    const key = `${endpoint.baseUrl} ${endpoint.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { models: [main, ...models.slice(1, 1 + MAX_FALLBACKS)] };
}

/** One model of the setting; a fallback takes from the main one what it does not say. */
function endpointOf(entry: unknown, main: ModelEndpoint | null): ModelEndpoint | null {
  if (!isRecord(entry) || !isName(entry.model)) return null;
  const baseUrl = entry.baseUrl ?? main?.baseUrl;
  if (!isName(baseUrl)) return null;
  const sameProvider = main !== null && baseUrl === main.baseUrl;
  const keySecret =
    entry.keySecret === undefined
      ? main === null
        ? DEFAULT_KEY_SECRET
        : sameProvider
          ? main.keySecret
          : null
      : entry.keySecret;
  if (keySecret !== null && (typeof keySecret !== 'string' || !KEY_SECRET.test(keySecret))) {
    return null;
  }
  const responseFormat =
    entry.responseFormat ?? (sameProvider ? main.responseFormat : 'json_schema');
  if (!RESPONSE_FORMATS.includes(responseFormat as ResponseFormatMode)) return null;
  const timeoutMs = entry.timeoutMs ?? (sameProvider ? main.timeoutMs : undefined);
  if (timeoutMs !== undefined && !isTimeout(timeoutMs)) return null;
  return {
    baseUrl,
    model: entry.model,
    keySecret,
    responseFormat: responseFormat as ResponseFormatMode,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

/** A whole number of milliseconds between 1 s and 2 min: a local model in a CPU may need more. */
function isTimeout(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_TIMEOUT_MS &&
    (value as number) <= MAX_TIMEOUT_MS
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
