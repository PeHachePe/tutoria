/** One message of a conversation with the model, as the OpenAI chat API has them. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** A JSON schema the answer must follow, when the provider can enforce it. */
export interface AnswerFormat {
  readonly name: string;
  readonly schema: Record<string, unknown>;
}

/** The model that writes the tutor's answers (2.6): another provider is another class. */
export interface LlmProvider {
  /** Which model answers, kept with each answer to compare models (2.5). */
  readonly model: string;
  /** The text of the model's answer. */
  complete(messages: readonly ChatMessage[], format: AnswerFormat): Promise<string>;
}

/** The provider did not answer, or not with an answer: the app says the tutor is unavailable. */
export class ProviderError extends Error {
  constructor(
    message: string,
    /** HTTP status of the provider, if it answered. */
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Long enough for a short answer of a Flash model; beyond it, the student would rather retry. */
export const MODEL_TIMEOUT_MS = 15_000;

/** Some freedom in the wording, little in the format. */
const TEMPERATURE = 0.4;

/**
 * Pause before asking once more when the provider is overloaded for a moment (5xx): the free tier
 * of Gemini often answers «high demand» and succeeds a second later.
 */
export const OVERLOAD_RETRY_MS = 1_000;

export interface OpenAICompatibleSettings {
  /** Up to the version, without `/chat/completions`: Gemini, Ollama, OpenRouter, Groq, OpenAI… */
  readonly baseUrl: string;
  readonly model: string;
  /** Not needed by a local Ollama. */
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  /** Pause before the second try after a 5xx; 0 in the tests. */
  readonly overloadRetryMs?: number;
}

/**
 * Any provider with the chat completions API of OpenAI (§3): the same class talks to Gemini through
 * its compatible endpoint, to Ollama in local, or to OpenAI, by changing the URL, model and key.
 */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly model: string;

  constructor(
    private readonly settings: OpenAICompatibleSettings,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.model = settings.model;
  }

  /** The answer of the model; once more after a moment if the provider was overloaded (5xx). */
  async complete(messages: readonly ChatMessage[], format: AnswerFormat): Promise<string> {
    try {
      return await this.completeOnce(messages, format);
    } catch (error) {
      if (!(error instanceof ProviderError) || !isOverload(error.status)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, this.settings.overloadRetryMs ?? OVERLOAD_RETRY_MS),
      );
      return this.completeOnce(messages, format);
    }
  }

  private async completeOnce(
    messages: readonly ChatMessage[],
    format: AnswerFormat,
  ): Promise<string> {
    const { baseUrl, model, apiKey, timeoutMs = MODEL_TIMEOUT_MS } = this.settings;
    let response: Response;
    try {
      response = await this.fetchFn(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: TEMPERATURE,
          response_format: {
            type: 'json_schema',
            json_schema: { name: format.name, schema: format.schema },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'failed';
      throw new ProviderError(`The call to the model ${reason}`);
    }
    if (!response.ok) {
      // Only the provider's own explanation, short: the rest of its body may echo the request
      const reason = errorMessageOf(await response.json().catch(() => null));
      throw new ProviderError(
        `The model answered ${response.status}${reason ? `: ${reason}` : ''}`,
        response.status,
      );
    }
    const content = contentOf(await response.json().catch(() => null));
    if (content === null) throw new ProviderError('The model sent no answer');
    return content;
  }
}

/** A failure of the provider that may pass in a moment, unlike a wrong key or a missing model. */
function isOverload(status: number | undefined): boolean {
  return status !== undefined && status >= 500;
}

/** Longest explanation of a failure worth logging. */
const MAX_REASON_LENGTH = 200;

/**
 * The message of an error of an OpenAI-compatible API: `{ error: { message } }`, also inside a list
 * as Gemini sends it.
 */
function errorMessageOf(body: unknown): string | null {
  const error: unknown = (Array.isArray(body) ? body[0] : body)?.error;
  const message: unknown =
    typeof error === 'object' && error !== null && 'message' in error ? error.message : null;
  return typeof message === 'string' ? message.slice(0, MAX_REASON_LENGTH) : null;
}

/** The text of the first choice, or `null` if the body has none. */
function contentOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('choices' in body)) return null;
  const choices = body.choices;
  if (!Array.isArray(choices)) return null;
  const content: unknown = choices[0]?.message?.content;
  return typeof content === 'string' ? content : null;
}
