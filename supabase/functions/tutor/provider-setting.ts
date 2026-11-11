import type { ModelEndpoint, ProviderSetting, ResponseFormatMode } from './answer-store.ts';

/** The secret with the key of the main provider, when the setting names none. */
export const DEFAULT_KEY_SECRET = 'AI_API_KEY';

/**
 * The only secrets the setting may name: `AI_API_KEY`, `AI_GROQ_API_KEY`… An administrator writes
 * the setting, so it must not be a way to send another secret of the function, such as the
 * `service_role`, to a provider.
 */
const KEY_SECRET = /^AI_(?:[A-Z0-9]+_)*API_KEY$/;

const RESPONSE_FORMATS: readonly ResponseFormatMode[] = ['json_schema', 'json_object', 'none'];

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
 * valid model, a repeated one or the main one itself is left out.
 */
export function providerSettingOf(value: unknown): ProviderSetting | null {
  if (!isRecord(value)) return null;
  const main = endpointOf(value, null);
  if (!main) return null;
  const fallbacks = (Array.isArray(value.fallbacks) ? value.fallbacks : []).flatMap((entry) => {
    const endpoint = endpointOf(typeof entry === 'string' ? { model: entry } : entry, main);
    return endpoint ? [endpoint] : [];
  });
  const seen = new Set<string>();
  const models = [main, ...fallbacks].filter((endpoint) => {
    const key = `${endpoint.baseUrl} ${endpoint.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { models: [main, ...models.slice(1)] };
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
