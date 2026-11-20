import { disabled, type SchemaPathTree, validate } from '@angular/forms/signals';

import type { DuplicateOptions, ManagedGroup } from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { classSchema } from './class-form';
import { nextSchoolYear } from '../../data/school-year';

/**
 * A class as «Duplicar» copies it (5.2c, D-079; 5.2d, D-081): the class it goes to, the groups of the
 * user copied into it and what they bring.
 */
export interface DuplicateFormModel {
  readonly name: string;
  readonly schoolYear: string;
  /** The groups to duplicate: a copy of each, in its subject, with its label and teacher. */
  readonly groupIds: readonly string[];
  readonly blocks: boolean;
  readonly dates: boolean;
  readonly students: boolean;
}

/**
 * The same name, the next school year (or the current one) and every group given, with its blocks
 * and dates but without its students: a new year is a new class.
 */
export function toDuplicateFormModel(
  source: SchoolClass,
  groups: readonly ManagedGroup[],
  today: Date,
): DuplicateFormModel {
  return {
    name: source.name,
    schoolYear: nextSchoolYear(source.schoolYear, today),
    groupIds: groups.map(({ group }) => group.id),
    blocks: true,
    dates: true,
    students: false,
  };
}

/** As a class, and at least one group to duplicate; the dates only go with the blocks. */
export function duplicateSchema(path: SchemaPathTree<DuplicateFormModel>): void {
  classSchema(path);
  validate(path.groupIds, ({ value }) =>
    value().length === 0
      ? {
          kind: 'required',
          message: $localize`:@@duplicateForm.error.groups:Elige al menos una asignatura`,
        }
      : null,
  );
  disabled(path.dates, ({ valueOf }) => !valueOf(path.blocks));
}

/** What the service is asked for: no dates without blocks. */
export function toDuplicateOptions(model: DuplicateFormModel): DuplicateOptions {
  return { blocks: model.blocks, dates: model.blocks && model.dates, students: model.students };
}
