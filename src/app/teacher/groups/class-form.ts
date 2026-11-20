import {
  maxLength,
  pattern,
  required,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import { type ClassDraft, SCHOOL_YEAR_PATTERN } from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { isSchoolYear } from './school-year';

/** Enough for «2.º DAW A · Mañanas»: the name goes in the selector of the screen. */
export const MAX_CLASS_NAME_LENGTH = 60;

/** A class as its dialog edits it, and, when it is new, the subjects the user teaches in it. */
export interface ClassFormModel {
  readonly name: string;
  readonly schoolYear: string;
  /** A group of each, of `teacherId`, when it is created; none when it is edited. */
  readonly subjectIds: readonly string[];
  readonly teacherId: string;
}

/** A new class, with the year and teacher given, or one to edit. */
export function toClassFormModel(
  schoolClass: SchoolClass | null,
  defaults: { readonly schoolYear: string; readonly teacherId: string | undefined },
): ClassFormModel {
  return {
    name: schoolClass?.name ?? '',
    schoolYear: schoolClass?.schoolYear ?? defaults.schoolYear,
    subjectIds: [],
    teacherId: defaults.teacherId ?? '',
  };
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

/**
 * As `classSchema`, and the teacher of its groups while there are subjects. Joining a class that
 * exists (one of `classes`) needs a subject at least: without one nothing would change.
 */
export function newClassSchema(classes: readonly SchoolClass[]) {
  return (path: SchemaPathTree<ClassFormModel>): void => {
    classSchema(path);
    validate(path.teacherId, ({ value, valueOf }) =>
      valueOf(path.subjectIds).length > 0 && value() === ''
        ? { kind: 'required', message: $localize`:@@groupForm.error.teacher:Elige el docente` }
        : null,
    );
    validate(path.subjectIds, ({ value, valueOf }) =>
      value().length === 0 &&
      existingClass(classes, { name: valueOf(path.name), schoolYear: valueOf(path.schoolYear) })
        ? {
            kind: 'required',
            message: $localize`:@@classForm.error.joinSubjects:Elige las asignaturas que das en ella`,
          }
        : null,
    );
  };
}

/** The name and the year without surrounding spaces. */
export function toClassDraft(model: ClassDraft): ClassDraft {
  return { name: model.name.trim(), schoolYear: model.schoolYear.trim() };
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
