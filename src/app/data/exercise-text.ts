/**
 * The texts of an exercise in a language of the interface (2.5b, D-045): the source texts, written
 * in the language the teacher chose, and their translations. The code of the exercise (the name of
 * its function and what it returns) is the same in every language, so nothing else depends on it.
 *
 * The catalog, the workspace and the Edge Function `tutor` use it. The Edge Function imports this
 * file as it is, so it must not import anything: the Edge Runtime resolves every import, also those
 * of types, and only with their extension (D-042).
 */

/** The languages of the interface: the same as `AppLocale` (core/i18n/locale.ts), checked in a test. */
export type ExerciseLocale = 'es' | 'en' | 'ca';

/** What is read of an exercise, in one language. */
export interface ExerciseText {
  readonly title: string;
  readonly statement: string;
  /** What the exercise practises, shown under its title in the catalog. */
  readonly topics: readonly string[];
}

/** The texts in every language but the source one; any of them can be missing. */
export type ExerciseTranslations = Partial<Record<ExerciseLocale, ExerciseText>>;

/** An exercise with its source texts and their translations. */
export interface TranslatableExercise extends ExerciseText {
  /** The language of `title`, `statement` and `topics`. */
  readonly sourceLocale: ExerciseLocale;
  readonly translations: ExerciseTranslations;
}

/** The texts to show, with the language they are in: not the one asked for if there was no translation. */
export interface LocalizedExerciseText extends ExerciseText {
  readonly locale: ExerciseLocale;
}

/** The texts in `locale`, or the source ones, never a gap. */
export function exerciseText(
  exercise: TranslatableExercise,
  locale: ExerciseLocale,
): LocalizedExerciseText {
  const translation = locale === exercise.sourceLocale ? undefined : exercise.translations[locale];
  if (translation) {
    const { title, statement, topics } = translation;
    return { title, statement, topics, locale };
  }
  const { title, statement, topics, sourceLocale } = exercise;
  return { title, statement, topics, locale: sourceLocale };
}
