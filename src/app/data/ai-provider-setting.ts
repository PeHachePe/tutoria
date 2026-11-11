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
