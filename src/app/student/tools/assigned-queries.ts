import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise, Difficulty } from '../../data/exercise';
import {
  blockTitle,
  type ContentLocale,
  exerciseText,
  subjectName,
} from '../../data/localized-text';
import type { TOOL_STATUSES } from '../../data/tutor/tutor-tools';
import { countByStatus, nextExercise } from '../catalog/catalog-blocks';

/** How many of the assigned exercises are in each status; `pending` is any not submitted. */
export interface ProgressCounts {
  readonly assigned: number;
  readonly notStarted: number;
  readonly inProgress: number;
  readonly failing: number;
  readonly passed: number;
  readonly submitted: number;
  readonly pending: number;
}

export interface SubjectProgress extends ProgressCounts {
  readonly subject: string;
  readonly group: string;
}

/** What `getMyProgress` gives (2.5e): the counts of each subject the student studies, and in all. */
export interface ProgressSummary {
  readonly subjects: readonly SubjectProgress[];
  readonly total: ProgressCounts;
}

/** An assigned exercise as a tool gives it: the id is the one of its assignment. */
export interface FoundExercise {
  readonly id: string;
  readonly title: string;
  readonly block: string;
  readonly subject: string;
  readonly status: AttemptStatus;
  readonly difficulty: Difficulty;
}

export interface ExerciseFilters {
  readonly text?: string;
  readonly status?: (typeof TOOL_STATUSES)[number];
  readonly difficulty?: Difficulty;
  readonly limit?: number;
}

/** The exercises a search gives when it does not say how many. */
export const DEFAULT_SEARCH_LIMIT = 5;

/** Shorter words («de», «un») say nothing about an exercise. */
const MIN_WORD_LENGTH = 3;

/** The progress of each group of the student, one per subject, optionally only some subjects. */
export function progressSummary(
  entries: readonly AssignedExercise[],
  locale: ContentLocale,
  subject?: string,
): ProgressSummary {
  const groups = [...new Set(entries.map((entry) => entry.group.id))].map((groupId) =>
    entries.filter((entry) => entry.group.id === groupId),
  );
  const subjects = groups
    .map((ofGroup) => ({
      subject: subjectName(ofGroup[0].group.subject, locale).name,
      group: ofGroup[0].group.name,
      ...counts(ofGroup),
    }))
    .filter((each) => !subject || normalized(each.subject).includes(normalized(subject)));
  const shown = entries.filter((entry) =>
    subjects.some((each) => each.subject === subjectName(entry.group.subject, locale).name),
  );
  return { subjects, total: counts(shown) };
}

function counts(entries: readonly AssignedExercise[]): ProgressCounts {
  const byStatus = countByStatus(entries);
  return {
    assigned: entries.length,
    notStarted: byStatus.not_started,
    inProgress: byStatus.in_progress,
    failing: byStatus.tests_failed,
    passed: byStatus.passed,
    submitted: byStatus.submitted,
    pending: entries.length - byStatus.submitted,
  };
}

/**
 * The assigned exercises that match, best matches first and otherwise in the order of the catalog:
 * words of the title, a topic, the block or the subject (without accents, singular or plural), a
 * status and a difficulty.
 */
export function searchAssigned(
  entries: readonly AssignedExercise[],
  { text, status, difficulty, limit = DEFAULT_SEARCH_LIMIT }: ExerciseFilters,
  locale: ContentLocale,
): FoundExercise[] {
  return scored(entries, text, locale)
    .filter(({ entry }) => matchesStatus(entry.status, status))
    .filter(({ entry }) => !difficulty || entry.exercise.difficulty === difficulty)
    .slice(0, limit)
    .map(({ entry }) => found(entry, locale));
}

/**
 * The exercise a tool should open: `next` is the one the catalog suggests; otherwise, the id of the
 * assignment or of the exercise, or the best match of the words, the pending ones first.
 */
export function findAssigned(
  entries: readonly AssignedExercise[],
  query: string,
  locale: ContentLocale,
): AssignedExercise | null {
  if (query === 'next') return nextExercise(entries)?.entry ?? null;
  const byId = entries.find((entry) => entry.assignmentId === query || entry.exercise.id === query);
  if (byId) return byId;
  const [best] = scored(entries, query, locale).sort(
    (a, b) => b.score - a.score || pendingFirst(a.entry) - pendingFirst(b.entry),
  );
  return best?.entry ?? null;
}

function pendingFirst(entry: AssignedExercise): number {
  return entry.status === 'submitted' ? 1 : 0;
}

/** Each entry with how many words of the text it has; without a text, every entry. */
function scored(
  entries: readonly AssignedExercise[],
  text: string | undefined,
  locale: ContentLocale,
): { readonly entry: AssignedExercise; readonly score: number }[] {
  const all = entries.map((entry) => ({ entry, score: 0 }));
  if (text === undefined) return all;
  const words = wordsOf(text);
  return all
    .map(({ entry }) => {
      const haystack = searchableText(entry, locale);
      return { entry, score: words.filter((word) => haystack.includes(word)).length };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}

/** What a search looks in: the texts in the language of the interface and in the original one. */
function searchableText(entry: AssignedExercise, locale: ContentLocale): string {
  const shown = exerciseText(entry.exercise, locale);
  return normalized(
    [
      shown.title,
      ...shown.topics,
      entry.exercise.title,
      ...entry.exercise.topics,
      blockTitle(entry.block, locale).title,
      subjectName(entry.group.subject, locale).name,
    ].join(' '),
  );
}

/** The words that say something, as stems: «vectores» finds «vector» and «bucle» finds «bucles». */
function wordsOf(text: string): string[] {
  return normalized(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD_LENGTH)
    .map((word) => (word.length > 4 ? word.replace(/e?s$/, '') : word));
}

function matchesStatus(
  status: AttemptStatus,
  wanted: (typeof TOOL_STATUSES)[number] | undefined,
): boolean {
  if (!wanted) return true;
  return wanted === 'pending' ? status !== 'submitted' : status === wanted;
}

function found(entry: AssignedExercise, locale: ContentLocale): FoundExercise {
  return {
    id: entry.assignmentId,
    title: exerciseText(entry.exercise, locale).title,
    block: blockTitle(entry.block, locale).title,
    subject: subjectName(entry.group.subject, locale).name,
    status: entry.status,
    difficulty: entry.exercise.difficulty,
  };
}

/** Lower case and without accents, to compare what people write. */
function normalized(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
