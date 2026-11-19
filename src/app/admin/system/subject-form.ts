import {
  applyWhen,
  maxLength,
  required,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import type { SubjectDraft } from '../../data/admin-service';
import { type ContentLocale, subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import { searchable } from '../../shared/searchable';
import { CONTENT_LOCALES } from '../../teacher/exercises/exercise-form-model';

/** As long as the title of a block: it is shown beside the name of a group. */
export const SUBJECT_NAME_LENGTH = 120;

/** A subject as its dialog edits it: a name per language, the empty ones not translated (D-045). */
export interface SubjectFormModel {
  readonly sourceLocale: ContentLocale;
  readonly names: Readonly<Record<ContentLocale, string>>;
}

/** The model of a subject, or of a new one written in the language of the interface. */
export function toSubjectFormModel(
  subject: Subject | null,
  locale: ContentLocale,
): SubjectFormModel {
  const names = { es: '', en: '', ca: '' };
  if (!subject) return { sourceLocale: locale, names };
  for (const other of CONTENT_LOCALES) {
    names[other] = subject.translations[other]?.name ?? '';
  }
  names[subject.sourceLocale] = subject.name;
  return { sourceLocale: subject.sourceLocale, names };
}

/** What is saved: the source name and the translations written, without surrounding spaces. */
export function toSubjectDraft(model: SubjectFormModel, id: string | null): SubjectDraft {
  const translations: Partial<Record<ContentLocale, { name: string }>> = {};
  for (const locale of CONTENT_LOCALES) {
    const name = model.names[locale].trim();
    if (locale !== model.sourceLocale && name !== '') translations[locale] = { name };
  }
  return {
    ...(id === null ? {} : { id }),
    name: model.names[model.sourceLocale].trim(),
    sourceLocale: model.sourceLocale,
    translations,
  };
}

/** The names the other subjects show in each language, as `searchable()` writes them. */
export type TakenSubjectNames = Readonly<Record<ContentLocale, ReadonlySet<string>>>;

/**
 * The names of every subject but the one edited (`exceptId`), as each language shows them: its own
 * there or, without it, the original. Two subjects that look the same in a language could not be
 * told apart when a teacher picks the subject of a group.
 */
export function takenSubjectNames(
  subjects: readonly Subject[],
  exceptId: string | null,
): TakenSubjectNames {
  const others = subjects.filter((subject) => subject.id !== exceptId);
  const namesIn = (locale: ContentLocale) =>
    new Set(others.map((subject) => searchable(subjectName(subject, locale).name.trim())));
  return { es: namesIn('es'), en: namesIn('en'), ca: namesIn('ca') };
}

/**
 * Only the name of the language it is written in is required, and not just spaces; the others are
 * translations. No name may be one another subject shows in that language.
 */
export function subjectSchema(taken: () => TakenSubjectNames) {
  return (path: SchemaPathTree<SubjectFormModel>): void => {
    for (const locale of CONTENT_LOCALES) {
      const name = path.names[locale];
      applyWhen(
        name,
        ({ valueOf }) => valueOf(path.sourceLocale) === locale,
        (source) => {
          const message = $localize`:@@subjectForm.error.name:Escribe el nombre de la asignatura`;
          required(source, { message });
          // Spaces alone are not a name: the table turns it down (btrim(name) <> '')
          validate(source, ({ value }) =>
            value() !== '' && value().trim() === '' ? { kind: 'required', message } : null,
          );
        },
      );
      maxLength(name, SUBJECT_NAME_LENGTH, {
        message: $localize`:@@subjectForm.error.nameLength:Como mucho ${SUBJECT_NAME_LENGTH}:max: caracteres`,
      });
      validate(name, ({ value }) =>
        value().trim() !== '' && taken()[locale].has(searchable(value().trim()))
          ? {
              kind: 'taken',
              message: $localize`:@@subjectForm.error.taken:Ya hay una asignatura con ese nombre`,
            }
          : null,
      );
    }
  };
}
