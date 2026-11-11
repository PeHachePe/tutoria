import { z } from 'zod';

import {
  EMOTIONS,
  type Emotion,
  type Intensity,
  REACTION_KINDS,
  type ReactionKind,
  skeletonBlock,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import type { AnswerFormat } from './llm-provider.ts';

/** What the model answers (2.6), once checked. */
export interface ModelAnswer {
  readonly message: string;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  /** Only one of the catalog; any other is dropped and the app uses the one of the emotion. */
  readonly reaction?: ReactionKind;
  /** The student tried to get the solution. */
  readonly elusion: boolean;
}

/** Why an answer of the model is not good enough, which decides how to ask again. */
export type AnswerProblem = 'invalid' | 'code';

export type AnswerCheck =
  | { readonly ok: true; readonly answer: ModelAnswer }
  | {
      readonly ok: false;
      readonly problem: AnswerProblem;
      /** An answer turned down for its code still says whether the student asked for the solution. */
      readonly elusion?: boolean;
    };

const answerSchema = z.object({
  message: z.string(),
  emotion: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(3),
  reaction: z.string().optional(),
  elusion: z.boolean().default(false),
  // A wrong one is dropped, never a reason to ask again: the answer is still good without it
  skeleton: z.array(z.string()).optional().catch(undefined),
});

/** The shape the provider is asked to follow, when it can (`response_format`). */
export const ANSWER_FORMAT: AnswerFormat = {
  name: 'tutor_answer',
  schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      emotion: { type: 'string', enum: [...EMOTIONS] },
      intensity: { type: 'integer', minimum: 1, maximum: 3 },
      reaction: { type: 'string', enum: [...REACTION_KINDS] },
      elusion: { type: 'boolean' },
      // The names of the parameters of the empty skeleton, which the server writes (2.5d)
      skeleton: { type: 'array', items: { type: 'string' } },
    },
    required: ['message', 'emotion', 'intensity', 'reaction', 'elusion'],
  },
};

/**
 * Lines that look like code rather than words: a declaration or a statement, an assignment, a lone
 * brace or a line ending in `;`. Words that talk about the code («fíjate en el bucle») are fine.
 */
const CODE_LINES: readonly RegExp[] = [
  /^\s*(?:function|const|let|var|return|for|while|if|else|switch|class|do)\b[^.!?¿¡]*[({;=]/,
  /^\s*[\w$.[\]]+\s*(?:[+\-*/%]?=|\+\+|--)(?!=)/,
  /^\s*[{}][\s;)]*$/,
  /=>/,
  /;\s*$/,
];

/** The function an exercise asks for: its name and how many parameters it takes. */
export interface FunctionSignature {
  readonly functionName: string;
  /** Unknown without tests: then any number will do. */
  readonly parameters: number | undefined;
}

/** The signature of the function of an exercise, with as many parameters as its tests pass. */
export function signatureOf({
  functionName,
  tests,
}: {
  readonly functionName: string;
  readonly tests: readonly { readonly input: readonly unknown[] }[];
}): FunctionSignature {
  return { functionName, parameters: tests[0]?.input.length };
}

/** A fenced block, with or without its language: ```js … ```. */
const FENCED_BLOCK = /```[\w-]*\n?([\s\S]*?)```/g;

/** The empty function: `function name(a, b) {` and its closing brace, with nothing between. */
const EMPTY_FUNCTION = /^function\s+([\w$]+)\s*\(([^)]*)\)\s*\{\s*\}$/;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Whether the message carries code: a fenced block, or a line that looks like code (2.6). With the
 * signature of the exercise, a block with only its empty function is fine (2.5d): the skeleton is
 * for a student who does not know how to start, and its body is where the logic would go.
 */
export function containsCode(message: string, skeleton?: FunctionSignature): boolean {
  const words = skeleton
    ? message.replace(FENCED_BLOCK, (block, body: string) =>
        isEmptySkeleton(body, skeleton) ? '' : block,
      )
    : message;
  return words.includes('```') || words.split('\n').some((line) => looksLikeCode(line));
}

function looksLikeCode(line: string): boolean {
  return CODE_LINES.some((pattern) => pattern.test(line));
}

/** The function of the exercise with its name, plain parameters (no defaults) and an empty body. */
function isEmptySkeleton(block: string, { functionName, parameters }: FunctionSignature): boolean {
  const match = EMPTY_FUNCTION.exec(block.trim());
  if (match?.[1] !== functionName) return false;
  const names = match[2].trim() ? match[2].split(',').map((name) => name.trim()) : [];
  return (
    names.every((name) => IDENTIFIER.test(name)) &&
    (parameters === undefined || names.length === parameters)
  );
}

/**
 * Checks what the model wrote: JSON with the shape of 2.6, a message unless the tutor chose to keep
 * quiet when it steps in on its own, and no code but the empty skeleton of the exercise's function,
 * when its signature is given (2.5d). When the model asks for the skeleton (`skeleton`, with the
 * names of its parameters), the server writes it under the message: the model does not have to get
 * a block of code right inside a JSON string, and nothing but the empty function can come out of it.
 * A reaction outside the catalog is dropped, not asked again (D-035). Models often wrap the JSON in a
 * fenced block: it is read from the outer braces.
 */
export function checkAnswer(
  raw: string,
  mayKeepQuiet: boolean,
  skeleton?: FunctionSignature,
): AnswerCheck {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  const result = answerSchema.safeParse(parsed);
  if (!result.success) return { ok: false, problem: 'invalid' };
  const { message, emotion, intensity, reaction, elusion, skeleton: names } = result.data;
  const text = message.trim();
  if (!text && !mayKeepQuiet) return { ok: false, problem: 'invalid' };
  if (containsCode(text, skeleton)) return { ok: false, problem: 'code', elusion };
  // Asked for, with something to say and not written already (the validator let only that through)
  const addSkeleton = skeleton && names?.length && text && !text.includes('```');
  return {
    ok: true,
    answer: {
      message: addSkeleton
        ? `${text}\n${skeletonBlock(skeleton.functionName, skeleton.parameters ?? names.length, names)}`
        : text,
      emotion,
      intensity: intensity as Intensity,
      reaction: isReactionKind(reaction) ? reaction : undefined,
      elusion,
    },
  };
}

function isReactionKind(reaction: string | undefined): reaction is ReactionKind {
  return (REACTION_KINDS as readonly string[]).includes(reaction ?? '');
}
