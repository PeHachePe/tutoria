import type { SolutionCheck } from '../../data/code-runner/run-result';
import type { Difficulty, Exercise } from '../../data/exercise';
import type { ExerciseDraft, ExerciseWithTests } from '../../data/exercise-service';
import type { ContentLocale, ExerciseText, ExerciseTranslations } from '../../data/localized-text';
import { skeletonCode } from '../../data/tutor/tutor-contract';
import type { StatementContent } from '../../student/workspace/statement-zone/statement-zone';

/** The languages an exercise can be written in, in the order of the tabs of the form. */
export const CONTENT_LOCALES: readonly ContentLocale[] = ['es', 'en', 'ca'];

/** Thresholds of a new exercise, the same as the table defaults (2.3). */
export const DEFAULT_MAX_REPEATED_FAILURES = 3;
export const DEFAULT_MAX_IDLE_MINUTES = 4;

/** What marks the title of a duplicated exercise, in the language of each title. */
const COPY_SUFFIX: Readonly<Record<ContentLocale, string>> = {
  es: '(copia)',
  en: '(copy)',
  ca: '(còpia)',
};

/** The texts of one language as the form edits them: the topics, as a list with commas. */
export interface TextFields {
  readonly title: string;
  readonly statement: string;
  readonly topics: string;
}

/**
 * A test as the form edits it: the arguments as they go in the call (`[1, 2, 3], 2`) and the
 * expected value, both written as JSON.
 */
export interface TestRow {
  readonly input: string;
  readonly expected: string;
  readonly isHidden: boolean;
}

/**
 * The model of the exercise form (4.3): plain texts the teacher types, turned into an
 * `ExerciseDraft` on saving. Every language has its tab; `sourceLocale` says which is the original.
 */
export interface ExerciseFormModel {
  readonly sourceLocale: ContentLocale;
  readonly texts: Readonly<Record<ContentLocale, TextFields>>;
  readonly difficulty: Difficulty;
  readonly subjectIds: readonly string[];
  readonly functionName: string;
  /** The names of the parameters, separated by commas. */
  readonly parameters: string;
  readonly maxRepeatedFailures: number;
  readonly maxIdleMinutes: number;
  readonly tests: readonly TestRow[];
}

/** The id of an exercise that is only being previewed. */
const PREVIEW_ID = 'preview';

const EMPTY_TEXTS: TextFields = { title: '', statement: '', topics: '' };

/**
 * A test to fill, a new object each time: Signal Forms follows the items of a list by their identity
 * (it marks the object), so two tests must never share one.
 */
export function emptyTest(): TestRow {
  return { input: '', expected: '', isHidden: false };
}

/** A value as JSON, with a space after commas and colons, as people write it: `[1, 2, 3]`. */
export function formatJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(formatJson).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${formatJson(item)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return JSON.stringify(value);
}

/** The arguments of a call, written as in the call and separated by commas, or undefined. */
export function parseArguments(text: string): unknown[] | undefined {
  const parsed = parseJson(`[${text}]`);
  return Array.isArray(parsed?.value) ? parsed.value : undefined;
}

/** One JSON value, or undefined if the text is empty or not JSON. */
export function parseValue(text: string): { readonly value: unknown } | undefined {
  return text.trim() === '' ? undefined : parseJson(text);
}

/** The items of a list written with commas, trimmed and without blanks. */
export function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** A new exercise, written in the language of the interface, with an empty test to fill. */
export function emptyFormModel(locale: ContentLocale): ExerciseFormModel {
  return {
    sourceLocale: locale,
    texts: { es: EMPTY_TEXTS, en: EMPTY_TEXTS, ca: EMPTY_TEXTS },
    difficulty: 'initial',
    subjectIds: [],
    functionName: '',
    parameters: '',
    maxRepeatedFailures: DEFAULT_MAX_REPEATED_FAILURES,
    maxIdleMinutes: DEFAULT_MAX_IDLE_MINUTES,
    tests: [emptyTest()],
  };
}

/** The form of an exercise of the bank. */
export function toFormModel({ exercise, tests, subjectIds }: ExerciseWithTests): ExerciseFormModel {
  const texts = Object.fromEntries(
    CONTENT_LOCALES.map((locale) => {
      const text = locale === exercise.sourceLocale ? exercise : exercise.translations[locale];
      return [locale, text ? textFieldsOf(text) : EMPTY_TEXTS];
    }),
  ) as Record<ContentLocale, TextFields>;
  return {
    sourceLocale: exercise.sourceLocale,
    texts,
    difficulty: exercise.difficulty,
    subjectIds,
    functionName: exercise.functionName,
    parameters: exercise.parameters.join(', '),
    maxRepeatedFailures: exercise.maxRepeatedFailures,
    maxIdleMinutes: exercise.maxIdleMinutes,
    tests: tests.map((test) => ({
      input: test.input.map(formatJson).join(', '),
      expected: formatJson(test.expectedOutput),
      isHidden: test.isHidden,
    })),
  };
}

/** The form of a new exercise that starts as a copy of another, to adapt it («Duplicar»). */
export function copyFormModel(entry: ExerciseWithTests): ExerciseFormModel {
  const model = toFormModel(entry);
  const texts = Object.fromEntries(
    CONTENT_LOCALES.map((locale) => {
      const text = model.texts[locale];
      const title = text.title === '' ? '' : `${text.title} ${COPY_SUFFIX[locale]}`;
      return [locale, { ...text, title }];
    }),
  ) as Record<ContentLocale, TextFields>;
  return { ...model, texts };
}

/**
 * The exercise to save. Only call it with a valid model (the schema of the form): an argument or a
 * value that is not JSON would be lost. A translation is kept if any of its texts is written.
 */
export function toDraft(model: ExerciseFormModel): ExerciseDraft {
  const source = toExerciseText(model.texts[model.sourceLocale]);
  const translations: ExerciseTranslations = Object.fromEntries(
    CONTENT_LOCALES.filter(
      (locale) => locale !== model.sourceLocale && hasText(model.texts[locale]),
    ).map((locale) => [locale, toExerciseText(model.texts[locale])]),
  );
  return {
    ...source,
    difficulty: model.difficulty,
    sourceLocale: model.sourceLocale,
    translations,
    functionName: model.functionName.trim(),
    parameters: splitList(model.parameters),
    maxRepeatedFailures: model.maxRepeatedFailures,
    maxIdleMinutes: model.maxIdleMinutes,
    subjectIds: model.subjectIds,
    tests: model.tests.map((test, position) => ({
      input: parseArguments(test.input) ?? [],
      expectedOutput: parseValue(test.expected)?.value ?? null,
      isHidden: test.isHidden,
      position,
    })),
  };
}

/** The exercise as the form has it now, to preview it as the student will read it. */
export function previewContent(model: ExerciseFormModel): StatementContent {
  const draft = toDraft(model);
  const exercise: Exercise = {
    title: draft.title,
    statement: draft.statement,
    topics: draft.topics,
    sourceLocale: draft.sourceLocale,
    translations: draft.translations,
    difficulty: draft.difficulty,
    functionName: draft.functionName,
    parameters: draft.parameters,
    maxRepeatedFailures: draft.maxRepeatedFailures,
    maxIdleMinutes: draft.maxIdleMinutes,
    id: PREVIEW_ID,
    language: 'javascript',
    createdBy: '',
    createdAt: '',
    updatedAt: '',
  };
  const all = draft.tests.map((test) => ({
    ...test,
    id: `${PREVIEW_ID}-${test.position}`,
    exerciseId: PREVIEW_ID,
  }));
  return {
    exercise,
    visibleTests: all.filter((test) => !test.isHidden),
    hiddenTestCount: all.filter((test) => test.isHidden).length,
  };
}

/**
 * «Probar mi solución» (4.3c): the teacher's code against the tests of the form as they are now,
 * saved or not. Only call it with a valid function and valid tests (the schema of the form).
 */
export function toSolutionCheck(model: ExerciseFormModel, code: string): SolutionCheck {
  const { functionName, tests } = toDraft(model);
  return {
    code,
    functionName,
    tests: tests.map(({ input, expectedOutput, isHidden }) => ({
      input,
      expectedOutput,
      isHidden,
    })),
  };
}

/** The empty function the teacher's solution starts from: the skeleton the tutor gives (2.5d). */
export function solutionSkeleton(model: ExerciseFormModel): string {
  return skeletonCode(model.functionName.trim(), splitList(model.parameters));
}

/** Whether the teacher wrote anything in the tab of a language. */
export function hasText(texts: TextFields): boolean {
  return [texts.title, texts.statement, texts.topics].some((text) => text.trim() !== '');
}

/** The texts of a language as the fields of its tab edit them. */
export function textFieldsOf(text: ExerciseText): TextFields {
  return { title: text.title, statement: text.statement, topics: text.topics.join(', ') };
}

/** The texts of a tab, trimmed and with the topics as a list. */
export function toExerciseText(fields: TextFields): ExerciseText {
  return {
    title: fields.title.trim(),
    statement: fields.statement.trim(),
    topics: splitList(fields.topics),
  };
}

function parseJson(text: string): { readonly value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}
