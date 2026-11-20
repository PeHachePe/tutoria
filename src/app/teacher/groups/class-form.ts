import {
  maxLength,
  pattern,
  required,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import {
  type ClassDraft,
  SCHOOL_YEAR_PATTERN,
  type SchoolClassEntry,
} from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { isSchoolYear } from './school-year';

/** Enough for «2.º DAW A · Mañanas»: the name goes in the selector of the screen. */
export const MAX_CLASS_NAME_LENGTH = 60;

/** A class as its dialog edits it: its name and year. Its subjects are added apart (5.2d). */
export type ClassFormModel = ClassDraft;

/** A new class in the year given, or one to edit. */
export function toClassFormModel(
  schoolClass: SchoolClass | null,
  schoolYear: string,
): ClassFormModel {
  return { name: schoolClass?.name ?? '', schoolYear: schoolClass?.schoolYear ?? schoolYear };
}

/** The name and the year, as the database checks them. Also the schema of duplicating a class. */
export function classSchema(path: SchemaPathTree<ClassDraft>): void {
  required(path.name, {
    message: $localize`:@@classForm.error.name:Escribe el nombre de la clase`,
  });
  maxLength(path.name, MAX_CLASS_NAME_LENGTH, {
    message: $localize`:@@groupForm.error.nameLength:Como mucho ${MAX_CLASS_NAME_LENGTH}:max: caracteres`,
  });
  // Only spaces is no name: the server would refuse it with a generic error
  validate(path.name, ({ value }) =>
    value() !== '' && value().trim() === ''
      ? {
          kind: 'blank',
          message: $localize`:@@classForm.error.name:Escribe el nombre de la clase`,
        }
      : null,
  );
  required(path.schoolYear, { message: $localize`:@@groupForm.error.year:Escribe el curso` });
  pattern(path.schoolYear, SCHOOL_YEAR_PATTERN, {
    message: $localize`:@@groupForm.error.yearFormat:Escribe el curso como 2026/27`,
  });
  validate(path.schoolYear, ({ value }) =>
    SCHOOL_YEAR_PATTERN.test(value()) && !isSchoolYear(value())
      ? {
          kind: 'schoolYear',
          message: $localize`:@@groupForm.error.yearRange:Un curso son dos años seguidos, como 2026/27`,
        }
      : null,
  );
}

/** The name and the year without surrounding spaces. */
export function toClassDraft(model: ClassDraft): ClassDraft {
  return { name: model.name.trim(), schoolYear: model.schoolYear.trim() };
}

/** The entry of the class of the school with that name and year, as `existingClass`. */
export function existingEntry(
  classes: readonly SchoolClassEntry[],
  draft: ClassDraft,
): SchoolClassEntry | null {
  const found = existingClass(
    classes.map(({ schoolClass }) => schoolClass),
    draft,
  );
  return classes.find(({ schoolClass }) => schoolClass === found) ?? null;
}

/**
 * The class of the school with that name (whatever its capitals) and year: a new class with it is
 * not created, the user joins it.
 */
export function existingClass(
  classes: readonly SchoolClass[],
  draft: ClassDraft,
): SchoolClass | null {
  const { name, schoolYear } = toClassDraft(draft);
  return (
    classes.find(
      (row) => row.schoolYear === schoolYear && row.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}
