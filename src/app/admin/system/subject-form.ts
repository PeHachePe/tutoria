import { applyWhen, maxLength, required, type SchemaPathTree } from '@angular/forms/signals';

import type { SubjectDraft } from '../../data/admin-service';
import type { ContentLocale } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
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

/** Only the name of the language it is written in is required; the others are translations. */
export function subjectSchema(path: SchemaPathTree<SubjectFormModel>): void {
  for (const locale of CONTENT_LOCALES) {
    const name = path.names[locale];
    applyWhen(
      name,
      ({ valueOf }) => valueOf(path.sourceLocale) === locale,
      (source) =>
        required(source, {
          message: $localize`:@@subjectForm.error.name:Escribe el nombre de la asignatura`,
        }),
    );
    maxLength(name, SUBJECT_NAME_LENGTH, {
      message: $localize`:@@subjectForm.error.nameLength:Como mucho ${SUBJECT_NAME_LENGTH}:max: caracteres`,
    });
  }
}
