/**
 * The texts of what teachers and administrators write, in a language of the interface (2.5b, D-045):
 * the source texts, written in the language they chose, and their translations. Exercises, subjects
 * and blocks use it (2.5c). The code of an exercise (the name of its function and what it returns)
 * is the same in every language, so nothing else depends on it.
 *
 * The catalog, the workspace and the Edge Function `tutor` use it. The Edge Function imports this
 * file as it is, so it must not import anything: the Edge Runtime resolves every import, also those
 * of types, and only with their extension (D-042).
 */

/** The languages of the interface: the same as `AppLocale` (core/i18n/locale.ts), checked in a test. */
export type ContentLocale = 'es' | 'en' | 'ca';

/** Something written in one language, with its texts in the others; any of them can be missing. */
export interface Translatable<Text extends object> {
  /** The language of the source texts. */
  readonly sourceLocale: ContentLocale;
  readonly translations: Partial<Record<ContentLocale, Text>>;
}

/** Texts to show, with the language they are in: not the one asked for if there was no translation. */
export type Localized<Text extends object> = Text & { readonly locale: ContentLocale };

/** What is read of an exercise, in one language. */
export interface ExerciseText {
  readonly title: string;
  readonly statement: string;
  /** What the exercise practises, shown under its title in the catalog. */
  readonly topics: readonly string[];
}

/** The texts of an exercise in every language but the source one. */
export type ExerciseTranslations = Translatable<ExerciseText>['translations'];

/** An exercise with its source texts and their translations. */
export type TranslatableExercise = ExerciseText & Translatable<ExerciseText>;

/** The texts to show, with the language they are in. */
export type LocalizedExerciseText = Localized<ExerciseText>;

/** The texts of an exercise in `locale`, or the source ones, never a gap. */
export function exerciseText(
  exercise: TranslatableExercise,
  locale: ContentLocale,
): LocalizedExerciseText {
  const { title, statement, topics } = exercise;
  const text = pick(exercise, { title, statement, topics }, locale);
  return {
    title: text.title,
    statement: text.statement,
    topics: text.topics,
    locale: text.locale,
  };
}

/** The name of a subject in `locale`, or the source one. */
export function subjectName(
  subject: { readonly name: string } & Translatable<{ readonly name: string }>,
  locale: ContentLocale,
): Localized<{ readonly name: string }> {
  const { name, locale: shown } = pick(subject, { name: subject.name }, locale);
  return { name, locale: shown };
}

/** The title of a block in `locale`, or the source one. */
export function blockTitle(
  block: { readonly title: string } & Translatable<{ readonly title: string }>,
  locale: ContentLocale,
): Localized<{ readonly title: string }> {
  const { title, locale: shown } = pick(block, { title: block.title }, locale);
  return { title, locale: shown };
}

/** The translation into `locale` or, without one, the source texts in their language. */
function pick<Text extends object>(
  item: Translatable<Text>,
  source: Text,
  locale: ContentLocale,
): Localized<Text> {
  const translation = locale === item.sourceLocale ? undefined : item.translations[locale];
  return translation ? { ...translation, locale } : { ...source, locale: item.sourceLocale };
}
