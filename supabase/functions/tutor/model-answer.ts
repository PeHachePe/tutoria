import { z } from 'zod';

import {
  EMOTIONS,
  type Emotion,
  type Intensity,
  REACTION_KINDS,
  type ReactionKind,
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
  | { readonly ok: false; readonly problem: AnswerProblem };

const answerSchema = z.object({
  message: z.string(),
  emotion: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(3),
  reaction: z.string().optional(),
  elusion: z.boolean().default(false),
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

/** Whether the message carries code: a fenced block, or a line that looks like code (2.6). */
export function containsCode(message: string): boolean {
  return message.includes('```') || message.split('\n').some((line) => looksLikeCode(line));
}

function looksLikeCode(line: string): boolean {
  return CODE_LINES.some((pattern) => pattern.test(line));
}

/**
 * Checks what the model wrote: JSON with the shape of 2.6, a message unless the tutor chose to keep
 * quiet when it steps in on its own, and no code. A reaction outside the catalog is dropped, not
 * asked again (D-035). Models often wrap the JSON in a fenced block: it is read from the outer
 * braces.
 */
export function checkAnswer(raw: string, mayKeepQuiet: boolean): AnswerCheck {
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
  const { message, emotion, intensity, reaction, elusion } = result.data;
  const text = message.trim();
  if (!text && !mayKeepQuiet) return { ok: false, problem: 'invalid' };
  if (containsCode(text)) return { ok: false, problem: 'code' };
  return {
    ok: true,
    answer: {
      message: text,
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
