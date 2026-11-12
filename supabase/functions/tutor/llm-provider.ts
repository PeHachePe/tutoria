import type { ResponseFormatMode } from './answer-store.ts';

/** One message of a conversation with the model, as the OpenAI chat API has them. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** A JSON schema the answer must follow, when the provider can enforce it. */
export interface AnswerFormat {
  readonly name: string;
  readonly schema: Record<string, unknown>;
  /**
   * The tools of the answer (2.5e): each one is a property of the group it belongs to (`query` or
   * `actions`) in the JSON, or a tool of its own when the provider is asked with tools.
   */
  readonly tools?: readonly FormatTool[];
}

export interface FormatTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly group: 'query' | 'actions';
}

/** The tool that carries the answer itself when the provider is asked with tools (D-051). */
export const RESPOND_TOOL = 'respond';

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
  /** How the format of the answer is asked: the JSON schema by default (D-043). */
  readonly responseFormat?: ResponseFormatMode;
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
          ...responseFormatOf(this.settings.responseFormat ?? 'json_schema', format),
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
    const body: unknown = await response.json().catch(() => null);
    const content = this.settings.responseFormat === 'tools' ? toolAnswerOf(body, format) : null;
    const answer = content ?? contentOf(body);
    if (answer === null) throw new ProviderError('The model sent no answer');
    return answer;
  }
}

/**
 * Time a request may spend going down the chain of models: past it, no other model is tried and the
 * student is told the tutor is not available, rather than left waiting. Two slow failures fit, plus
 * a quick answer of the next model.
 */
export const FALLBACK_BUDGET_MS = 30_000;

export interface FallbackOptions {
  /** 30 s by default; the tests shorten it. */
  readonly budgetMs?: number;
  readonly now?: () => number;
}

/**
 * The model of the setting and, if it fails, its fallback models in order, as many as the setting
 * lists (D-044): the free tier of Gemini runs out or gets overloaded per model, so another model
 * often answers when the first one cannot. Any failure of a model moves to the next one, which then
 * answers the rest of the request, until one answers, the list ends or the time budget is spent.
 */
export class FallbackProvider implements LlmProvider {
  private current = 0;
  private startedAt: number | null = null;
  private readonly budgetMs: number;
  private readonly now: () => number;

  constructor(
    private readonly models: readonly [LlmProvider, ...LlmProvider[]],
    { budgetMs = FALLBACK_BUDGET_MS, now = Date.now }: FallbackOptions = {},
  ) {
    this.budgetMs = budgetMs;
    this.now = now;
  }

  /** The model that gave the last answer: the main one until it fails. */
  get model(): string {
    return this.models[this.current].model;
  }

  async complete(messages: readonly ChatMessage[], format: AnswerFormat): Promise<string> {
    this.startedAt ??= this.now();
    for (;;) {
      try {
        return await this.models[this.current].complete(messages, format);
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        const next = this.models[this.current + 1];
        if (!next || this.now() - this.startedAt >= this.budgetMs) throw error;
        console.warn(`${error.message}; the fallback model ${next.model} answers`);
        this.current++;
      }
    }
  }
}

/**
 * The `response_format` of the request: the schema where the provider takes it (Gemini, OpenAI,
 * Ollama), plain JSON where it only knows that, or nothing; the validator checks the answer anyway.
 */
function responseFormatOf(mode: ResponseFormatMode, format: AnswerFormat): Record<string, unknown> {
  switch (mode) {
    case 'json_schema':
      return {
        response_format: {
          type: 'json_schema',
          json_schema: { name: format.name, schema: format.schema },
        },
      };
    case 'json_object':
      return { response_format: { type: 'json_object' } };
    case 'none':
      return {};
    case 'tools':
      return toolsRequestOf(format);
  }
}

/**
 * The answer asked as calls to tools (D-051): the answer itself is the tool `respond`, with the
 * schema of the answer without its groups of tools, and each tool of the contract is one more. The
 * model must call at least one, so it never answers in plain text.
 */
function toolsRequestOf(format: AnswerFormat): Record<string, unknown> {
  const tools = format.tools ?? [];
  const properties = { ...(format.schema.properties as Record<string, unknown>) };
  for (const group of new Set(tools.map((tool) => tool.group))) delete properties[group];
  return {
    tools: [
      {
        type: 'function',
        function: {
          name: RESPOND_TOOL,
          description: 'The answer to the student, as described in the instructions.',
          parameters: { ...format.schema, properties },
        },
      },
      ...tools.map(({ name, description, parameters }) => ({
        type: 'function',
        function: { name, description, parameters },
      })),
    ],
    tool_choice: 'required',
  };
}

/**
 * The calls to tools of the model as the JSON of the answer, so the rest of the function reads it as
 * any other: `respond` gives its fields, and each tool goes into its group. Null if it called none.
 */
function toolAnswerOf(body: unknown, format: AnswerFormat): string | null {
  const calls: unknown = (body as { choices?: { message?: { tool_calls?: unknown } }[] } | null)
    ?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return null;
  const answer: Record<string, unknown> = {};
  const groups: Record<string, Record<string, unknown>> = {};
  for (const call of calls) {
    const name: unknown = call?.function?.name;
    let args: unknown;
    try {
      args = JSON.parse(call?.function?.arguments ?? 'null');
    } catch {
      continue;
    }
    if (name === RESPOND_TOOL && typeof args === 'object' && args !== null) {
      Object.assign(answer, args);
      continue;
    }
    const tool = format.tools?.find((candidate) => candidate.name === name);
    if (tool) groups[tool.group] = { ...groups[tool.group], [tool.name]: args };
  }
  // Only a query and no answer: the message waits for the data
  if (!('message' in answer)) Object.assign(answer, { message: '' });
  return JSON.stringify({ ...answer, ...groups });
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
