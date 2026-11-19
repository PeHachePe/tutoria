import type { AiCheckProblem, AiModelCheck } from '../../../src/app/data/ai-provider-setting.ts';
import {
  bearerToken,
  BodyTooLargeError,
  failure,
  json,
  preflight,
  readJson,
  tooLarge,
} from '../_shared/http.ts';
import {
  type AnswerFormat,
  type ChatMessage,
  type LlmProvider,
  MODEL_TIMEOUT_MS,
  ProviderError,
} from '../_shared/llm-provider.ts';
import { type ModelEndpoint, providerSettingOf } from '../_shared/provider-setting.ts';
import type { StaffRequests } from '../_shared/staff-requests.ts';

/** Checks the administration may ask for in a minute: each one calls every model of the setting. */
export const AI_CHECKS_PER_MINUTE = 5;

/** And in a day: plenty to set the provider up, not enough to spend its quota from this screen. */
export const AI_CHECKS_PER_DAY = 100;

/** A setting with its fallbacks is far smaller. */
export const MAX_CHECK_BODY_BYTES = 10_000;

/** The shortest question: what matters is that the model answers, not what. */
export const CHECK_MESSAGES: readonly ChatMessage[] = [
  { role: 'user', content: 'Reply with {"ok": true} and nothing else.' },
];

export const CHECK_FORMAT: AnswerFormat = {
  name: 'check',
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
};

/** What the function reads, with `service_role` (`SupabaseAiCheckStore`). */
export interface AiCheckStore {
  /** The user of a session token, or `null` if it is not valid. */
  userOf(token: string): Promise<string | null>;
  /** Whether they are an active administrator. */
  isActiveAdmin(userId: string): Promise<boolean>;
}

export interface AiCheckDependencies {
  readonly store: AiCheckStore;
  readonly staff: StaffRequests;
  /** Whether the functions may call a base URL (`allowedHosts()` with `AI_ALLOWED_HOSTS`). */
  readonly mayCall: (baseUrl: string) => boolean;
  /** A secret of the function, as `Deno.env.get`. */
  readonly secretOf: (name: string) => string | undefined;
  /** A provider of that model alone, with its key. */
  readonly providerOf: (endpoint: ModelEndpoint, apiKey: string | undefined) => LlmProvider;
  /** Milliseconds, to time each answer; `performance.now` by default. */
  readonly now?: () => number;
}

/**
 * The Edge Function `ai-check` (5.3a, RF-19, CU-07): before the administration saves a setting of the
 * AI provider, each of its models is asked for a minimal answer, one after another and in order, and
 * the screen gets one result per model: how long it took or why it did not answer. Only for an active
 * administrator, with its limits. Nothing is saved, and neither the text of the model nor that of its
 * error is answered: only the kind of the problem.
 */
export function createAiCheckHandler({
  store,
  staff,
  mayCall,
  secretOf,
  providerOf,
  now = () => performance.now(),
}: AiCheckDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    try {
      const token = bearerToken(request);
      const userId = token ? await store.userOf(token) : null;
      if (!userId) return failure(401, 'Sign in to check the AI provider');
      if (!(await store.isActiveAdmin(userId))) {
        return failure(403, 'Only the administration checks the AI provider');
      }
      const body = await readJson(request, MAX_CHECK_BODY_BYTES);

      const wait = await staff.claim(userId, 'ai_check', AI_CHECKS_PER_MINUTE, AI_CHECKS_PER_DAY);
      if (wait === null) return failure(403, 'Only the administration checks the AI provider');
      if (wait > 0) return failure(429, 'Too many checks', { 'Retry-After': String(wait) });

      // Every host first, so one that is not allowed says so instead of disappearing from the list
      const setting = providerSettingOf(body, () => true);
      if (!setting) return json(200, [problemOf(body, 'invalid')]);
      const [main] = setting.models;
      if (!mayCall(main.baseUrl))
        return json(200, [{ model: main.model, problem: 'host_not_allowed' }]);

      const checks: AiModelCheck[] = [];
      for (const endpoint of setting.models) {
        checks.push(await check(endpoint, { mayCall, secretOf, providerOf, now }));
      }
      return json(200, checks);
    } catch (error) {
      if (error instanceof BodyTooLargeError) return tooLarge();
      console.error(error);
      return failure(500, 'The check of the AI provider failed');
    }
  };
}

type CheckDependencies = Required<
  Pick<AiCheckDependencies, 'mayCall' | 'secretOf' | 'providerOf' | 'now'>
>;

async function check(
  endpoint: ModelEndpoint,
  { mayCall, secretOf, providerOf, now }: CheckDependencies,
): Promise<AiModelCheck> {
  const { model, keySecret } = endpoint;
  if (!mayCall(endpoint.baseUrl)) return { model, problem: 'host_not_allowed' };
  const apiKey = keySecret === null ? undefined : secretOf(keySecret);
  if (keySecret !== null && !apiKey) return { model, problem: 'no_key' };
  const start = now();
  try {
    await providerOf(endpoint, apiKey).complete(CHECK_MESSAGES, CHECK_FORMAT);
    return { model, ms: Math.round(now() - start) };
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    // The provider's message stays in the logs: it may echo the request
    console.warn(`The check of ${model} failed: ${error.message}`);
    const timedOut = now() - start >= (endpoint.timeoutMs ?? MODEL_TIMEOUT_MS);
    return { model, problem: problemOfStatus(error.status, timedOut) };
  }
}

/** The kind of a failure of the provider, by its HTTP status. */
export function problemOfStatus(status: number | undefined, timedOut: boolean): AiCheckProblem {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === undefined && timedOut) return 'timeout';
  return 'unavailable';
}

/** The result of a body that is not a setting: with its model, if it has one to show. */
function problemOf(body: unknown, problem: AiCheckProblem): AiModelCheck {
  const model =
    typeof body === 'object' && body !== null && 'model' in body && typeof body.model === 'string'
      ? body.model
      : '';
  return { model, problem };
}
