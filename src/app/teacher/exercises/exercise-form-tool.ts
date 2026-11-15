import type { Difficulty } from '../../data/exercise';
import type { ContentLocale } from '../../data/localized-text';
import type { TutorToolDefinition } from '../../data/tutor/tutor-tools';
import { EXERCISE_LIMITS } from './exercise-form-schema';
import { CONTENT_LOCALES, type ExerciseFormModel } from './exercise-form-model';

/** More tests than an exercise needs, as the server checks them (`MAX_CHECK_TESTS`). */
const MAX_TOOL_TESTS = 50;
const MAX_TOPICS = 10;
const MAX_STATEMENT_LENGTH = 5000;

/**
 * The exercise form as a tool of WebMCP (4.3c, D-059): an agent of the browser fills it and the
 * teacher reviews it and saves it. It never saves, unlike the implicit tool of Signal Forms
 * (`experimentalWebMcpTool`), which also needs a value in every list to infer its schema and does
 * not describe its fields. Only what it is given changes; the subjects go by their names.
 */
export const FILL_EXERCISE_FORM = {
  name: 'fillExerciseForm',
  description:
    'Fills the exercise form open now for the teacher to review: nothing is saved until they press the button. Only the fields given change. The texts are in `language`; the code (the function, its parameters and the values of the tests) is always in English and quoted between backticks in the statement. Answers with the errors left in the form and the subjects to choose from.',
  use: 'confirm',
  webMcp: true,
  inputSchema: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: CONTENT_LOCALES,
        description: 'The language the title, the statement and the topics are written in.',
      },
      title: { type: 'string', minLength: 1, maxLength: EXERCISE_LIMITS.titleLength },
      statement: {
        type: 'string',
        minLength: 1,
        maxLength: MAX_STATEMENT_LENGTH,
        description: 'For the student, with the code between backticks: `countWords("a b")`.',
      },
      topics: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 80 },
        maxItems: MAX_TOPICS,
        description: 'What the exercise practises: Loops, accumulator.',
      },
      difficulty: { type: 'string', enum: ['initial', 'medium', 'advanced', 'extension'] },
      subjects: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 120 },
        maxItems: 10,
        description: 'Names of the subjects it is meant for, as the answer lists them.',
      },
      functionName: { type: 'string', minLength: 1, maxLength: 100, description: 'countWords' },
      parameters: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 100 },
        maxItems: EXERCISE_LIMITS.maxParameters,
        description: 'Names of the parameters, in order: ["text"].',
      },
      tests: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_TOOL_TESTS,
        description: 'Replace every test of the form.',
        items: {
          type: 'object',
          properties: {
            arguments: {
              type: 'string',
              maxLength: 2000,
              description:
                'The arguments as JSON, separated by commas as in the call: `[1, 2], 3`.',
            },
            expected: {
              type: 'string',
              minLength: 1,
              maxLength: 2000,
              description: 'The value it must return, as JSON: `6`, `"hola"`, `[1, 2]`.',
            },
            hidden: {
              type: 'boolean',
              description: 'The student only learns whether it passes: for the edge cases.',
            },
          },
          required: ['arguments', 'expected'],
          additionalProperties: false,
        },
      },
      maxRepeatedFailures: {
        type: 'integer',
        minimum: EXERCISE_LIMITS.minRepeatedFailures,
        maximum: EXERCISE_LIMITS.maxRepeatedFailures,
        description: 'Failures of the same test in a row before the tutor offers help.',
      },
      maxIdleMinutes: {
        type: 'integer',
        minimum: EXERCISE_LIMITS.minIdleMinutes,
        maximum: EXERCISE_LIMITS.maxIdleMinutes,
        description: 'Minutes without activity before the tutor offers help.',
      },
    },
    additionalProperties: false,
  },
} as const satisfies TutorToolDefinition;

/** What an agent may write in the form, once checked against the schema. */
export interface FormFill {
  readonly language?: ContentLocale;
  readonly title?: string;
  readonly statement?: string;
  readonly topics?: readonly string[];
  readonly difficulty?: Difficulty;
  /** The ids of the subjects its names found. */
  readonly subjectIds?: readonly string[];
  readonly functionName?: string;
  readonly parameters?: readonly string[];
  readonly tests?: readonly {
    readonly arguments: string;
    readonly expected: string;
    readonly hidden?: boolean;
  }[];
  readonly maxRepeatedFailures?: number;
  readonly maxIdleMinutes?: number;
}

/**
 * The model with what the agent wrote: the texts go to the tab of their language, which becomes
 * the original, and the rest keeps its value. Each test is a new object (Signal Forms follows them
 * by identity).
 */
export function fillFormModel(model: ExerciseFormModel, fill: FormFill): ExerciseFormModel {
  const sourceLocale = fill.language ?? model.sourceLocale;
  const texts = model.texts[sourceLocale];
  return {
    ...model,
    sourceLocale,
    texts: {
      ...model.texts,
      [sourceLocale]: {
        title: fill.title ?? texts.title,
        statement: fill.statement ?? texts.statement,
        topics: fill.topics?.join(', ') ?? texts.topics,
      },
    },
    difficulty: fill.difficulty ?? model.difficulty,
    subjectIds: fill.subjectIds ?? model.subjectIds,
    functionName: fill.functionName ?? model.functionName,
    parameters: fill.parameters?.join(', ') ?? model.parameters,
    maxRepeatedFailures: fill.maxRepeatedFailures ?? model.maxRepeatedFailures,
    maxIdleMinutes: fill.maxIdleMinutes ?? model.maxIdleMinutes,
    tests:
      fill.tests?.map((test) => ({
        input: test.arguments,
        expected: test.expected,
        isHidden: test.hidden ?? false,
      })) ?? model.tests,
  };
}

/** The subjects of some names, without minding case or accents, and the names that are none. */
export function subjectsByName(
  names: readonly string[],
  subjects: readonly { readonly id: string; readonly name: string }[],
): { readonly ids: string[]; readonly unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const name of names) {
    const subject = subjects.find((candidate) => plain(candidate.name) === plain(name));
    if (!subject) unknown.push(name);
    else if (!ids.includes(subject.id)) ids.push(subject.id);
  }
  return { ids, unknown };
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}
