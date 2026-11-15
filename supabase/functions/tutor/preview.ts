import { z } from 'zod';

import { checkRunTests, MAX_CHECK_TESTS } from '../../../src/app/data/code-runner/run-result.ts';
import { EMOTIONS, TUTOR_TRIGGERS } from '../../../src/app/data/tutor/tutor-contract.ts';
import type { TutorAttempt } from './answer-store.ts';

/** The languages of the exercises (`ContentLocale`). */
const LOCALES = ['es', 'en', 'ca'] as const;

/** Far above what the form takes: a larger body is not an exercise (as `translate`). */
export const PREVIEW_LIMITS = {
  title: 200,
  statement: 10_000,
  topics: 20,
  topic: 100,
  name: 100,
  parameters: 10,
  /** Far above a long try: the hint level only needs the last turns. */
  turns: 40,
  transcript: 4_000,
  actions: 10,
} as const;

const textsSchema = z.object({
  title: z.string().max(PREVIEW_LIMITS.title),
  statement: z.string().max(PREVIEW_LIMITS.statement),
  topics: z.array(z.string().max(PREVIEW_LIMITS.topic)).max(PREVIEW_LIMITS.topics),
});

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/**
 * What the form sends instead of an attempt (4.3e, D-061): the exercise as it is, saved or not, and
 * the try so far, which lives only in the teacher's browser. The teacher is trying their own
 * exercise, so what they say of the try is taken as it comes; it only has to be the right shape.
 */
export const previewSchema = z.object({
  exercise: textsSchema.extend({
    sourceLocale: z.enum(LOCALES),
    translations: z.partialRecord(z.enum(LOCALES), textsSchema),
    functionName: z.string().trim().min(1).max(PREVIEW_LIMITS.name),
    parameters: z.array(z.string().max(PREVIEW_LIMITS.name)).max(PREVIEW_LIMITS.parameters),
    tests: z
      .array(
        z.object({
          input: z.array(z.unknown()),
          // A test of the form always has its expected value, as JSON: `null` at least
          expectedOutput: z.unknown().refine((value) => value !== undefined),
          isHidden: z.boolean(),
        }),
      )
      .min(1)
      .max(MAX_CHECK_TESTS),
  }),
  status: z.enum(['in_progress', 'tests_failed', 'passed']),
  lastRun: z
    .object({
      passed: z.int().min(0),
      failed: z.int().min(0),
      failedTestIds: z.array(z.string().max(PREVIEW_LIMITS.name)).max(MAX_CHECK_TESTS),
    })
    .nullable(),
  previous: z
    .array(
      z.object({
        trigger: z.enum(TUTOR_TRIGGERS),
        hintLevel: level,
        studentMessage: z.string().max(PREVIEW_LIMITS.transcript).nullable(),
        transcript: z.string().max(PREVIEW_LIMITS.transcript),
        emotion: z.enum(EMOTIONS),
        intensity: level,
        elusion: z.boolean(),
        actions: z
          .array(z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()) }))
          .max(PREVIEW_LIMITS.actions),
      }),
    )
    .max(PREVIEW_LIMITS.turns),
});

export type TutorPreview = z.infer<typeof previewSchema>;

/**
 * The try as the tutor knows an attempt: the caller's, with the code of the editor and the tests
 * with the ids of a check (`test-1`…), the same ones the app gives the results.
 */
export function previewAttempt(userId: string, code: string, preview: TutorPreview): TutorAttempt {
  const { exercise, status, lastRun, previous } = preview;
  const { tests, ...rest } = exercise;
  return {
    userId,
    // `claim_staff_request` only lets an active teacher or administrator through
    ownerActive: true,
    status,
    currentCode: code,
    exercise: {
      ...rest,
      tests: checkRunTests({ code, functionName: exercise.functionName, tests }),
    },
    lastRun,
    previous,
  };
}
