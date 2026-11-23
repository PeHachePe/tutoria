import { z } from 'zod';

import {
  answerHintLevel,
  type HintLevel,
  TUTOR_TRIGGERS,
  type TutorEvent,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import {
  MAX_TOOL_CALLS,
  type ToolCall,
  toolCallsOf,
} from '../../../src/app/data/tutor/tutor-tools.ts';
import { outputsEqual } from '../../../src/app/data/code-runner/run-result.ts';
import { PROACTIVE_REASONS } from '../../../src/app/shared/proactive-reason.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import type { StaffRequests } from '../_shared/staff-requests.ts';
import type { StudentRequests } from '../_shared/student-requests.ts';
import {
  bearerToken,
  BodyTooLargeError,
  failure,
  json,
  preflight,
  readJson,
  tooLarge,
} from '../_shared/http.ts';
import { MAX_CODE_LENGTH } from '../_shared/limits.ts';
import type { AnswerStore, RecordedAnswer, TutorAttempt } from './answer-store.ts';
import type { ProviderSetting } from '../_shared/provider-setting.ts';
import { checkCodeActions, tryExamples } from './code-actions.ts';
import { type LlmProvider, ProviderError } from '../_shared/llm-provider.ts';
import {
  ANSWER_FORMAT,
  checkAnswer,
  type ModelAnswer,
  queriesIn,
  signatureOf,
} from './model-answer.ts';
import { previewAttempt, previewSchema } from './preview.ts';
import { checkReason, type ProactiveFacts } from './proactive.ts';
import {
  buildMessages,
  PROMPT_VERSION,
  type PromptInput,
  retryMessages,
  TUTOR_LANGUAGES,
  type TutorLanguage,
} from './prompt.ts';

/**
 * Turns of the tutor a user may ask for in a minute: it is what spends the quota and the money of
 * the provider. A student asks, reads and thinks, so a handful is plenty. A turn is counted before
 * the model is called (D-063), whatever comes of it; the data the model asks the app for come back
 * in the same turn.
 */
export const TUTOR_CALLS_PER_MINUTE = 6;

/**
 * Turns of the tutor a user may ask for in a day (the last 24 hours): the free plans of the providers
 * limit the calls of the whole project in a day, so no student may spend the quota of the rest. A
 * long session of practice is far below it.
 */
export const TUTOR_CALLS_PER_DAY = 60;

/**
 * Calls to the model a teacher may make in a minute while trying an exercise as a student (4.3e,
 * D-061): as many as a student, counted apart with the requests of the staff.
 */
export const TUTOR_PREVIEWS_PER_MINUTE = TUTOR_CALLS_PER_MINUTE;

/**
 * And in a day: a teacher tries many exercises, so several times what a student may ask, but not
 * the quota of the day of the whole project from one account (D-063).
 */
export const TUTOR_PREVIEWS_PER_DAY = 200;

/** Far above the 500 characters of the chat: room for a spoken question (6.1). */
export const MAX_MESSAGE_LENGTH = 2_000;

/**
 * The data of the queries that come back (2.5e): far above what a student has (42 exercises), well
 * below what would make the call expensive.
 */
export const MAX_RESULTS_LENGTH = 12_000;

/** One more call if the first answer is not good enough; then, the friendly default (2.6). */
const MODEL_CALLS = 2;

/** What the tutor says when the model does not give a valid answer twice: encouraging, no hint. */
export const DEFAULT_ANSWERS: Record<TutorLanguage, string> = {
  es: '¡Vas por buen camino! Prueba tu función con el ejemplo más sencillo y compara lo que devuelve con lo que se espera. ¿Dónde empiezan a separarse?',
  en: 'You are on the right track! Try your function with the simplest example and compare what it returns with what is expected. Where do they start to differ?',
  ca: 'Vas per bon camí! Prova la funció amb l’exemple més senzill i compara el que retorna amb el que s’espera. On comencen a separar-se?',
};

/** What every request carries, from a student or from a teacher trying an exercise. */
const askFields = {
  requestId: z.uuid(),
  kind: z.enum(TUTOR_TRIGGERS),
  // Why the tutor steps in (2.7): the server checks it (D-065)
  reason: z.enum(PROACTIVE_REASONS).optional(),
  message: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
  code: z.string().max(MAX_CODE_LENGTH),
  language: z.enum(TUTOR_LANGUAGES),
  // What the queries the model asked for gave, run by the app (2.5e)
  results: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.unknown()),
        result: z.unknown(),
      }),
    )
    .min(1)
    .max(MAX_TOOL_CALLS)
    .refine((results) => JSON.stringify(results).length <= MAX_RESULTS_LENGTH)
    // Only the queries of the contract, with their arguments: never a way to say anything else
    .refine(
      (results) =>
        toolCallsOf(
          Object.fromEntries(results.map((result) => [result.name, result.arguments])),
          'query',
        ).calls.length === results.length,
    )
    .optional(),
};

// Only a question carries a message, and it needs one; only an intervention a reason (2.6, 2.7)
const asksRight = ({
  kind,
  message,
  reason,
}: {
  kind: string;
  message?: string;
  reason?: string;
}) =>
  (kind === 'question') === Boolean(message) && (kind === 'proactive') === (reason !== undefined);

const requestSchema = z.object({ ...askFields, attemptId: z.uuid() }).refine(asksRight);

/**
 * A teacher trying an exercise as a student (4.3e, D-061): the exercise instead of an attempt. The
 * tutor never steps in on its own there: a preview has no process to read it from.
 */
const previewRequestSchema = z
  .object({ ...askFields, preview: previewSchema })
  .strict()
  .refine(asksRight)
  .refine(({ kind }) => kind !== 'proactive');

type TutorRequestBody = z.infer<typeof requestSchema>;

/** What a turn asks, whoever asks it. */
type Ask = Omit<TutorRequestBody, 'attemptId'>;

export interface TutorDependencies {
  readonly store: AnswerStore;
  /** The limits of the turns of a student, counted before the model is called (D-063). */
  readonly students: StudentRequests;
  /** The limit of the teachers who try an exercise (4.3e). */
  readonly staff: StaffRequests;
  /** The provider of the setting, with the key of the secrets. */
  readonly providerFor: (setting: ProviderSetting) => LlmProvider;
  /** Where the code is tried with the examples, so the model knows what it does now. */
  readonly sandbox: CodeSandbox;
}

/**
 * The Edge Function `tutor` (2.4): checks the session, that the attempt is the caller's and that it
 * is still open to them, counts the turn, decides the hint level, tries the code with the examples,
 * asks the model with the context of the attempt, checks its answer (2.6), keeps it with its process
 * event and answers with the events `meta` → `delta` → `done` all at once (no streaming, D-043). A
 * retry of a request already answered gets that answer back.
 *
 * With `preview` instead of `attemptId`, a teacher tries an exercise as a student (4.3e, D-061): the
 * exercise and the try come from the form, the limit is that of the staff, and the answer is the
 * same, but nothing is kept: no interaction, no process event.
 */
export function createTutorHandler({
  store,
  students,
  staff,
  providerFor,
  sandbox,
}: TutorDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    // The events of the request take this time, not that of the answer (D-090)
    const askedAt = new Date();
    try {
      const token = bearerToken(request);
      const userId = token ? await store.userOf(token) : null;
      if (!userId) return failure(401, 'Sign in to ask the tutor');
      const raw = await readJson(request);
      if (isPreview(raw)) return await answerPreview(userId, raw);
      const body = requestSchema.safeParse(raw);
      if (!body.success) {
        return failure(
          400,
          'Expected { requestId, attemptId, kind, reason?, message?, code, language, results? }',
        );
      }
      const ask = body.data;

      const attempt = await store.findAttempt(ask.attemptId);
      // Not the owner's: the same answer as an attempt that does not exist, as the RLS gives
      if (!attempt || attempt.userId !== userId) return failure(404, 'Attempt not found');
      if (!attempt.ownerActive) return failure(403, 'The account is disabled');
      if (attempt.status === 'submitted') return failure(409, 'The attempt is submitted');
      // Hidden, not open yet or out of the group: what the student no longer sees has no tutor
      if (!attempt.open) return failure(403, 'The exercise is not open');

      const answered = await store.findAnswer(ask.requestId);
      if (answered) return replay(answered, ask.attemptId);

      if (ask.results) {
        // The data of the queries the model asked for in this request, once: the same turn goes on.
        // Anything else would hand the model text as data it never asked for (D-063). Once also
        // if the provider fails then: this trip counts no turn, so it is never one to repeat, and
        // the app asks again from the start, which does count
        const waited = await store.takeQueries(ask.requestId, userId);
        if (!waited || !answersQueries(ask.results, waited)) {
          return failure(400, 'The tutor asked for no such data');
        }
      } else {
        // Counted before the code is tried and the model called: turns at once wait theirs, and
        // one the provider fails or that only asks for data counts too
        const wait = await students.claim(
          userId,
          'tutor',
          TUTOR_CALLS_PER_MINUTE,
          TUTOR_CALLS_PER_DAY,
        );
        if (wait > 0) return failure(429, 'Too many questions', { 'Retry-After': String(wait) });
      }

      // The browser chose to step in: the data of the server must hold its reason, or the tutor
      // keeps quiet without asking the model or keeping anything. The turn is counted (D-065)
      let facts: ProactiveFacts | undefined;
      if (ask.reason) {
        const activity = await store.findActivity(ask.attemptId);
        const held =
          activity && checkReason(ask.reason, attempt.status, activity, askedAt.getTime());
        if (!held) return json(200, { events: KEPT_QUIET });
        facts = held;
      }

      const turn = await answerTurn(ask, attempt, facts);
      if (turn instanceof Response) return turn;
      if ('queries' in turn) {
        // Nothing of the answer is kept until the model gives it with the data (2.5e)
        await store.keepQueries(ask.requestId, userId, turn.queries);
        return queryEvents(turn.queries);
      }
      const { answer, hintLevel, rejected, model } = turn;

      const outcome = await store.recordAnswer({
        attemptId: ask.attemptId,
        requestId: ask.requestId,
        trigger: ask.kind,
        hintLevel,
        studentMessage: ask.kind === 'question' ? (ask.message ?? null) : null,
        answer,
        promptVersion: PROMPT_VERSION,
        model,
        rejected,
        ...(ask.reason ? { reason: ask.reason } : {}),
        askedAt: askedAt.toISOString(),
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
      if (error instanceof BodyTooLargeError) return tooLarge();
      if (error instanceof ProviderError) {
        console.error(error.message);
        return failure(503, 'The AI provider is not available');
      }
      console.error(error);
      return failure(500, 'The tutor failed');
    }
  };

  /** The turn of a teacher trying an exercise: answered as a student's, and kept nowhere. */
  async function answerPreview(userId: string, raw: unknown): Promise<Response> {
    const body = previewRequestSchema.safeParse(raw);
    if (!body.success) {
      return failure(
        400,
        'Expected { requestId, preview, kind, message?, code, language, results? }, without interventions',
      );
    }
    const { preview, ...ask } = body.data;
    const wait = await staff.claim(
      userId,
      'tutor',
      TUTOR_PREVIEWS_PER_MINUTE,
      TUTOR_PREVIEWS_PER_DAY,
    );
    if (wait === null) return failure(403, 'Only a teacher tries an exercise');
    if (wait > 0) return failure(429, 'Too many questions', { 'Retry-After': String(wait) });
    const turn = await answerTurn(ask, previewAttempt(userId, ask.code, preview));
    if (turn instanceof Response) return turn;
    // Each trip of a preview counts as a request of the staff, so its data are taken as they come
    if ('queries' in turn) return queryEvents(turn.queries);
    return json(200, { events: eventsOf(turn.answer, turn.hintLevel, null) });
  }

  /**
   * What the tutor answers to a turn about an attempt: the level, the code tried with the examples,
   * the model's answer checked (2.6) and its actions checked against the attempt (2.5f); the queries
   * the model needs answered first (2.5e); or the response to give at once, when there is no provider.
   * An intervention comes with the facts of its reason (2.7).
   */
  async function answerTurn(
    ask: Ask,
    attempt: TutorAttempt,
    proactive?: ProactiveFacts,
  ): Promise<AnsweredTurn | AskedQueries | Response> {
    const setting = await store.providerSetting();
    if (!setting) return failure(503, 'No AI provider is set');
    const provider = providerFor(setting);
    const hintLevel = answerHintLevel(ask.kind, attempt.previous, ask.message);
    const tried = await tryExamples(sandbox, attempt, ask.code);
    const asked = await askModel(provider, {
      kind: ask.kind,
      hintLevel,
      message: ask.message,
      code: ask.code,
      language: ask.language,
      attempt,
      tried,
      results: ask.results,
      ...(proactive ? { proactive } : {}),
    });
    if ('queries' in asked) return asked;
    // What touches the code or the submission is checked against the attempt here, and a slip
    // that keeps the code from running gets its fix. Nobody asked for an intervention, so it does
    // nothing but fix that slip, and only for repeated failures (D-065)
    const fixes = !proactive || proactive.reason === 'failures';
    const answer = asked.answer
      ? withCheckedActions(
          asked.answer,
          await checkCodeActions(
            (asked.answer.actions ?? []).filter(
              (action) => !proactive || (fixes && action.name === 'proposeFix'),
            ),
            { attempt, code: ask.code, tried, sandbox },
            { offerFix: fixes },
          ),
        )
      : null;
    return { answer, hintLevel, rejected: asked.rejected, model: provider.model };
  }
}

/** The answer to a turn, ready to keep and to give. */
interface AnsweredTurn {
  /** `null` means keeping quiet. */
  readonly answer: ModelAnswer | null;
  readonly hintLevel: HintLevel;
  readonly rejected: number;
  readonly model: string;
}

/** The model needs data of the student first: the app reads them and asks again with them (2.5e). */
function queryEvents(queries: readonly ToolCall[]): Response {
  return json(200, { events: [{ type: 'query', calls: queries }] });
}

/** Whether the results are those of the queries the request waited for, one by one. */
function answersQueries(
  results: readonly { readonly name: string; readonly arguments: unknown }[],
  waited: readonly { readonly name: string; readonly arguments: unknown }[],
): boolean {
  return (
    results.length === waited.length &&
    waited.every(
      (call, index) =>
        results[index].name === call.name &&
        // As JSON, whatever the order of the keys: the database keeps them in its own
        outputsEqual(results[index].arguments, call.arguments),
    )
  );
}

/** A preview carries the exercise instead of an attempt. */
function isPreview(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'preview' in body;
}

/** The answer with the actions that held; with none left, as an answer that does nothing. */
function withCheckedActions(answer: ModelAnswer, actions: readonly ToolCall[]): ModelAnswer {
  const { actions: _asked, ...rest } = answer;
  return actions.length > 0 ? { ...rest, actions } : rest;
}

/** The answer the student gets, and how many answers of the model the validator turned down. */
interface CheckedAnswer {
  /** `null` means keeping quiet. */
  readonly answer: ModelAnswer | null;
  readonly rejected: number;
}

/** The model asked for data of the student before answering (2.5e). */
interface AskedQueries {
  readonly queries: readonly ToolCall[];
}

/**
 * The model's answer, once checked: if it is not valid JSON or it has code, the model is asked once
 * more reinforcing the rule; if it fails again, the default answer, or silence for an intervention
 * of the tutor (a generic message would interrupt for nothing). The answers turned down are counted,
 * to tell the prompt that held from the validator that stopped the model (D-044).
 */
async function askModel(
  provider: LlmProvider,
  input: PromptInput,
): Promise<CheckedAnswer | AskedQueries> {
  const mayKeepQuiet = input.kind === 'proactive';
  // The empty function of the exercise is the only code the tutor may write (2.5d), and nobody
  // asked for it in an intervention: there, no code at all
  const skeleton = mayKeepQuiet ? undefined : signatureOf(input.attempt.exercise);
  let messages = buildMessages(input);
  let elusion = false;
  for (let call = 1; call <= MODEL_CALLS; call++) {
    const raw = await provider.complete(messages, ANSWER_FORMAT);
    // A question may need data of the student, once: with the results, it answers (2.5e)
    if (input.kind === 'question' && !input.results) {
      const queries = queriesIn(raw);
      if (queries.length > 0) return { queries };
    }
    const check = checkAnswer(raw, {
      mayKeepQuiet,
      skeleton,
      // Examples of syntax answer a question; a hint is about the student's code (2.5d)
      examples: input.kind === 'question',
    });
    const rejected = call - 1;
    if (check.ok) return { answer: check.answer.message ? check.answer : null, rejected };
    console.warn(`Answer ${call} of the model rejected: ${check.problem}`);
    // An elusion stays recorded even if the default answer takes the place of the model's (2.6)
    elusion ||= check.elusion === true;
    messages = retryMessages(messages, raw, check.problem);
  }
  if (mayKeepQuiet) return { answer: null, rejected: MODEL_CALLS };
  return {
    answer: {
      message: DEFAULT_ANSWERS[input.language],
      emotion: 'encouragement',
      intensity: 1,
      elusion,
    },
    rejected: MODEL_CALLS,
  };
}

/** An intervention the tutor did not make: only `done`, silent, and the app shows nothing. */
const KEPT_QUIET: readonly TutorEvent[] = [{ type: 'done', interactionId: null, silent: true }];

/** The events of an answer, all at once; an intervention the tutor did not make is only `done`. */
function eventsOf(
  answer: ModelAnswer | null,
  hintLevel: HintLevel,
  interactionId: string | null,
): TutorEvent[] {
  if (!answer) return [...KEPT_QUIET];
  const { emotion, intensity, reaction, message, elusion, actions } = answer;
  return [
    {
      type: 'meta',
      emotion,
      intensity,
      hintLevel,
      ...(reaction ? { reaction } : {}),
      elusion,
      ...(actions?.length ? { actions } : {}),
    },
    { type: 'delta', text: message },
    { type: 'done', interactionId, silent: false },
  ];
}

/** The answer kept for the request, as it was given; a request id of another attempt is not it. */
function replay(answered: RecordedAnswer, attemptId: string): Response {
  if (answered.attemptId !== attemptId)
    return failure(400, 'The request belongs to another attempt');
  const { id, hintLevel, emotion, intensity, transcript, elusion, actions } = answered;
  return json(200, {
    // The reaction is not kept (D-036): the app shows the one of the emotion
    events: eventsOf(
      { message: transcript, emotion, intensity, elusion, actions: actions as ToolCall[] },
      hintLevel,
      id,
    ),
  });
}

async function replayRecorded(store: AnswerStore, ask: TutorRequestBody): Promise<Response> {
  const answered = await store.findAnswer(ask.requestId);
  if (!answered) throw new Error('A duplicate request without its answer');
  return replay(answered, ask.attemptId);
}
