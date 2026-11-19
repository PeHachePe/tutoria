/** How a provider wants the format of the answer asked (D-044). */
export type AiResponseFormat = 'json_schema' | 'json_object' | 'none';

/** A model of a provider with the chat API of OpenAI. Its key never leaves the server. */
export interface AiModelSetting {
  /** Up to the version; a fallback without it is of the main provider. */
  readonly baseUrl?: string;
  readonly model: string;
  /**
   * Name of the secret of the Edge Functions with its key (`AI_API_KEY`, `AI_GROQ_API_KEY`…),
   * never the key itself; `null` for none (a local Ollama).
   */
  readonly keySecret?: string | null;
  /** The JSON schema by default. */
  readonly responseFormat?: AiResponseFormat;
  /** Milliseconds it may take to answer, 1 s to 2 min; 15 s by default (a local model may need more). */
  readonly timeoutMs?: number;
}

/**
 * Value of the `ai_provider` row of table `app_setting`: the main model and its fallbacks, in
 * order, either another model of the same provider (its name) or one of another provider (D-044).
 */
export interface AiProviderSetting extends AiModelSetting {
  readonly baseUrl: string;
  readonly fallbacks?: readonly (string | AiModelSetting)[];
}

/** Why a model of a setting did not answer the check (5.3): never the text of the provider. */
export type AiCheckProblem =
  | 'invalid' // not the shape of a provider
  | 'host_not_allowed' // not the host of the project nor one of AI_ALLOWED_HOSTS
  | 'no_key' // the secret it names is not set
  | 'unauthorized'
  | 'not_found' // the provider does not know the model
  | 'rate_limited'
  | 'timeout'
  | 'unavailable';

/** How one model of the setting answered the check, in the order of the setting. */
export interface AiModelCheck {
  readonly model: string;
  /** Milliseconds it took to answer, if it did. */
  readonly ms?: number;
  /** Absent when the model answered. */
  readonly problem?: AiCheckProblem;
}

/** A provider the administration picks from a list, which fills in how to call it (CU-07). */
export interface AiProviderPreset {
  readonly id: string;
  readonly baseUrl: string;
  readonly keySecret: string | null;
  readonly responseFormat: AiResponseFormat;
}

/**
 * Gemini (the provider of the project), Groq, OpenRouter and a local Ollama, all with the chat API
 * of OpenAI. Groq and OpenRouter get plain JSON: not every model they serve follows a schema.
 */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keySecret: 'AI_API_KEY',
    responseFormat: 'json_schema',
  },
  {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keySecret: 'AI_GROQ_API_KEY',
    responseFormat: 'json_object',
  },
  {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keySecret: 'AI_OPENROUTER_API_KEY',
    responseFormat: 'json_object',
  },
  {
    id: 'ollama',
    // The host of the machine, from the container of the Edge Functions
    baseUrl: 'http://host.docker.internal:11434/v1',
    keySecret: null,
    responseFormat: 'json_schema',
  },
];

/** How many fallbacks a setting may have, as the check of `app_setting` (`is_valid_ai_provider`). */
export const MAX_AI_FALLBACKS = 5;

/** A URL of the web, as the check of `app_setting` asks. */
const WEB_URL = /^https?:\/\/[^/\s]+/;

/**
 * Whether the setting has the shape the check of `app_setting` asks (`is_valid_ai_provider`): the
 * main model with a URL of the web and a name, and up to `MAX_AI_FALLBACKS` fallbacks, each a name or
 * a model whose URL, if it has one, is of the web. The Edge Functions check the rest when they read it.
 */
export function isValidAiProvider(setting: AiProviderSetting): boolean {
  const fallbacks = setting.fallbacks ?? [];
  return (
    WEB_URL.test(setting.baseUrl) &&
    setting.model.trim() !== '' &&
    fallbacks.length <= MAX_AI_FALLBACKS &&
    fallbacks.every(
      (fallback) =>
        typeof fallback === 'string' ||
        fallback.baseUrl === undefined ||
        WEB_URL.test(fallback.baseUrl),
    )
  );
}
