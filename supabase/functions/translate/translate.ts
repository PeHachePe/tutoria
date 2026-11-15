import { bearerToken, failure, json, preflight } from '../_shared/http.ts';
import { type LlmProvider, ProviderError } from '../_shared/llm-provider.ts';
import type { ProviderSetting } from '../_shared/provider-setting.ts';
import type { StaffRequests } from '../_shared/staff-requests.ts';
import {
  checkTranslation,
  correctionMessage,
  requestSchema,
  TRANSLATION_FORMAT,
  translationMessages,
} from './translation.ts';

/** Translations a teacher may ask for in a minute: each one is a call to the model, or two. */
export const TRANSLATIONS_PER_MINUTE = 5;

/** Times the model is asked before giving up: a second time, telling it what was wrong. */
const MAX_TRIES = 2;

/** What the function reads, with `service_role` (`SupabaseTranslateStore`). */
export interface TranslateStore {
  /** The user of a session token, or `null` if it is not valid. */
  userOf(token: string): Promise<string | null>;
  providerSetting(): Promise<ProviderSetting | null>;
}

export interface TranslateDependencies {
  readonly store: TranslateStore;
  readonly staff: StaffRequests;
  /** The provider of the setting, with the key of the secrets: the same chain as the tutor. */
  readonly providerFor: (setting: ProviderSetting) => LlmProvider;
}

/**
 * The Edge Function `translate` (4.3c, D-059): the draft of a translation of an exercise, for the
 * teacher to review in the form. Only for teachers and the administration, with a limit per
 * minute, the same chain of models as the tutor (D-044) and nothing kept. A translation that changes
 * the code of the original is asked for once more and then turned down: the code is the same in
 * every language (D-045).
 */
export function createTranslateHandler({
  store,
  staff,
  providerFor,
}: TranslateDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    try {
      const token = bearerToken(request);
      const userId = token ? await store.userOf(token) : null;
      if (!userId) return failure(401, 'Sign in to translate');
      const body = requestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) {
        return failure(400, 'Expected { from, to, texts, functionName, parameters }');
      }
      const ask = body.data;

      const wait = await staff.claim(userId, 'translate', TRANSLATIONS_PER_MINUTE);
      if (wait === null) return failure(403, 'Only a teacher translates an exercise');
      if (wait > 0) return failure(429, 'Too many translations', { 'Retry-After': String(wait) });

      const setting = await store.providerSetting();
      if (!setting) return failure(503, 'No AI provider is set');
      const provider = providerFor(setting);
      const messages = translationMessages(ask);
      for (let tries = 1; ; tries++) {
        const answer = await provider.complete(messages, TRANSLATION_FORMAT);
        const check = checkTranslation(ask, answer);
        if (check.ok) return json(200, check.texts);
        console.warn(`The translation of ${provider.model} did not hold: ${check.problem}`);
        if (tries === MAX_TRIES) return failure(502, 'The translation did not keep the code');
        messages.push({ role: 'assistant', content: answer }, correctionMessage(check.problem));
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        console.error(error.message);
        return failure(503, 'The AI provider is not available');
      }
      console.error(error);
      return failure(500, 'The translation failed');
    }
  };
}
