import { z } from 'zod';

import { buildRunResult, type RunResult } from '../../../src/app/data/code-runner/run-result.ts';
import {
  answerHintLevel,
  type HintLevel,
  TUTOR_TRIGGERS,
  type TutorEvent,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import { bearerToken, failure, json, preflight } from '../_shared/http.ts';
import { MAX_CODE_LENGTH, minuteBefore, secondsToWait } from '../_shared/limits.ts';
import type { AnswerStore, ProviderSetting, RecordedAnswer, TutorAttempt } from './answer-store.ts';
import { type LlmProvider, ProviderError } from './llm-provider.ts';
import { ANSWER_FORMAT, checkAnswer, type ModelAnswer } from './model-answer.ts';
import {
  buildMessages,
  PROMPT_VERSION,
  type PromptInput,
  retryMessages,
  TUTOR_LANGUAGES,
  type TutorLanguage,
} from './prompt.ts';

/**
 * Calls to the model a user may make in a minute: it is what spends the quota and the money of the
 * provider. A student asks, reads and thinks, so a handful is plenty.
 */
export const TUTOR_CALLS_PER_MINUTE = 6;

/** Far above the 500 characters of the chat: room for a spoken question (6.1). */
export const MAX_MESSAGE_LENGTH = 2_000;

/** One more call if the first answer is not good enough; then, the friendly default (2.6). */
const MODEL_CALLS = 2;

/** What the tutor says when the model does not give a valid answer twice: encouraging, no hint. */
export const DEFAULT_ANSWERS: Record<TutorLanguage, string> = {
  es: '¡Vas por buen camino! Prueba tu función con el ejemplo más sencillo y compara lo que devuelve con lo que se espera. ¿Dónde empiezan a separarse?',
  en: 'You are on the right track! Try your function with the simplest example and compare what it returns with what is expected. Where do they start to differ?',
  ca: 'Vas per bon camí! Prova la funció amb l’exemple més senzill i compara el que retorna amb el que s’espera. On comencen a separar-se?',
};

const requestSchema = z
  .object({
    requestId: z.uuid(),
    attemptId: z.uuid(),
    kind: z.enum(TUTOR_TRIGGERS),
    message: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
    code: z.string().max(MAX_CODE_LENGTH),
    language: z.enum(TUTOR_LANGUAGES),
  })
  // Only a question carries a message, and it needs one (2.6)
  .refine(({ kind, message }) => (kind === 'question') === Boolean(message));

type TutorRequestBody = z.infer<typeof requestSchema>;

export interface TutorDependencies {
  readonly store: AnswerStore;
  /** The provider of the setting, with the key of the secrets. */
  readonly providerFor: (setting: ProviderSetting) => LlmProvider;
  /** Where the code is tried with the examples, so the model knows what it does now. */
  readonly sandbox: CodeSandbox;
  readonly now?: () => number;
}

/**
 * The Edge Function `tutor` (2.4): checks the session and that the attempt is the caller's, decides
 * the hint level, tries the code with the examples, asks the model with the context of the attempt, checks its answer (2.6), keeps it
 * with its process event and answers with the events `meta` → `delta` → `done` all at once (no
 * streaming, D-043). A retry of a request already answered gets that answer back.
 */
export function createTutorHandler({
  store,
  providerFor,
  sandbox,
  now = Date.now,
}: TutorDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    try {
      const token = bearerToken(request);
      const userId = token ? await store.userOf(token) : null;
      if (!userId) return failure(401, 'Sign in to ask the tutor');
      const body = requestSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) {
        return failure(400, 'Expected { requestId, attemptId, kind, message?, code, language }');
      }
      const ask = body.data;

      const attempt = await store.findAttempt(ask.attemptId);
      // Not the owner's: the same answer as an attempt that does not exist, as the RLS gives
      if (!attempt || attempt.userId !== userId) return failure(404, 'Attempt not found');
      if (!attempt.ownerActive) return failure(403, 'The account is disabled');
      if (attempt.status === 'submitted') return failure(409, 'The attempt is submitted');

      const answered = await store.findAnswer(ask.requestId);
      if (answered) return replay(answered, ask.attemptId);

      const wait = secondsToWait(
        await store.latestCalls(userId, minuteBefore(now()), TUTOR_CALLS_PER_MINUTE),
        TUTOR_CALLS_PER_MINUTE,
        now(),
      );
      if (wait > 0) return failure(429, 'Too many questions', { 'Retry-After': String(wait) });

      const setting = await store.providerSetting();
      if (!setting) return failure(503, 'No AI provider is set');
      const provider = providerFor(setting);
      const hintLevel = answerHintLevel(ask.kind, attempt.previous);
      const answer = await askModel(provider, {
        kind: ask.kind,
        hintLevel,
        message: ask.message,
        code: ask.code,
        language: ask.language,
        attempt,
        tried: await tryExamples(sandbox, attempt, ask.code),
      });

      const outcome = await store.recordAnswer({
        attemptId: ask.attemptId,
        requestId: ask.requestId,
        trigger: ask.kind,
        hintLevel,
        studentMessage: ask.kind === 'question' ? (ask.message ?? null) : null,
        answer,
        promptVersion: PROMPT_VERSION,
        model: provider.model,
      });
      switch (outcome.status) {
        case 'recorded':
          return json(200, { events: eventsOf(answer, hintLevel, outcome.interactionId) });
        case 'duplicate':
          // The same request arrived twice at once: both get the answer kept first
          return await replayRecorded(store, ask);
        case 'submitted':
          return failure(409, 'The attempt is submitted');
        case 'not_found':
          return failure(404, 'Attempt not found');
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        console.error(error.message);
        return failure(503, 'The AI provider is not available');
      }
      console.error(error);
      return failure(500, 'The tutor failed');
    }
  };
}

/**
 * The code as it is now with the examples, in the sandbox of `execute` (D-042): what it returns or
 * the error it throws, even if the student did not run it. Only the visible tests: the values of the
 * hidden ones must not reach the model. Nothing to try without code.
 */
async function tryExamples(
  sandbox: CodeSandbox,
  { exercise }: TutorAttempt,
  code: string,
): Promise<RunResult | null> {
  if (!code.trim()) return null;
  const examples = exercise.tests.filter((test) => !test.isHidden);
  const outcome = await sandbox.run({
    code,
    functionName: exercise.functionName,
    inputs: examples.map((test) => test.input),
  });
  return buildRunResult(examples, outcome);
}

/**
 * The model's answer, once checked: if it is not valid JSON or it has code, the model is asked once
 * more reinforcing the rule; if it fails again, the default answer, or silence for an intervention
 * of the tutor (a generic message would interrupt for nothing). `null` means keeping quiet.
 */
async function askModel(provider: LlmProvider, input: PromptInput): Promise<ModelAnswer | null> {
  const mayKeepQuiet = input.kind === 'proactive';
  let messages = buildMessages(input);
  for (let call = 1; call <= MODEL_CALLS; call++) {
    const raw = await provider.complete(messages, ANSWER_FORMAT);
    const check = checkAnswer(raw, mayKeepQuiet);
    if (check.ok) return check.answer.message ? check.answer : null;
    console.warn(`Answer ${call} of the model rejected: ${check.problem}`);
    messages = retryMessages(messages, raw, check.problem);
  }
  if (mayKeepQuiet) return null;
  return {
    message: DEFAULT_ANSWERS[input.language],
    emotion: 'encouragement',
    intensity: 1,
    elusion: false,
  };
}

/** The events of an answer, all at once; an intervention the tutor did not make is only `done`. */
function eventsOf(
  answer: ModelAnswer | null,
  hintLevel: HintLevel,
  interactionId: string | null,
): TutorEvent[] {
  if (!answer) return [{ type: 'done', interactionId: null, silent: true }];
  const { emotion, intensity, reaction, message } = answer;
  return [
    { type: 'meta', emotion, intensity, hintLevel, ...(reaction ? { reaction } : {}) },
    { type: 'delta', text: message },
    { type: 'done', interactionId, silent: false },
  ];
}

/** The answer kept for the request, as it was given; a request id of another attempt is not it. */
function replay(answered: RecordedAnswer, attemptId: string): Response {
  if (answered.attemptId !== attemptId)
    return failure(400, 'The request belongs to another attempt');
  const { id, hintLevel, emotion, intensity, transcript } = answered;
  return json(200, {
    // The reaction is not kept (D-036): the app shows the one of the emotion
    events: eventsOf({ message: transcript, emotion, intensity, elusion: false }, hintLevel, id),
  });
}

async function replayRecorded(store: AnswerStore, ask: TutorRequestBody): Promise<Response> {
  const answered = await store.findAnswer(ask.requestId);
  if (!answered) throw new Error('A duplicate request without its answer');
  return replay(answered, ask.attemptId);
}
