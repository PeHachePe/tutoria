import { disabled, type SchemaPathTree, validate } from '@angular/forms/signals';

import type { DuplicateOptions, ManagedGroup, UserRef } from '../../data/group-service';
import { classSchema } from './group-form';
import { nextSchoolYear } from './school-year';

/** A class as «Duplicar» copies it (5.2c, D-079): the new groups and what they bring. */
export interface DuplicateFormModel {
  readonly name: string;
  readonly schoolYear: string;
  readonly teacherId: string;
  /** The groups of the class to duplicate: a new one for each, in its subject. */
  readonly groupIds: readonly string[];
  readonly blocks: boolean;
  readonly dates: boolean;
  readonly students: boolean;
}

/**
 * The same name, the next school year (or the current one) and every group of the class, with its
 * blocks and dates but without its students: a new year is a new class. A teacher keeps their own
 * groups; an administrator, the teacher of the source while it is active.
 */
export function toDuplicateFormModel(
  source: ManagedGroup,
  classGroups: readonly ManagedGroup[],
  teachers: readonly UserRef[] | null,
  teacherId: string | undefined,
  today: Date,
): DuplicateFormModel {
  const sourceTeacher = source.group.teacherId;
  return {
    name: source.group.name,
    schoolYear: nextSchoolYear(source.group.schoolYear, today),
    teacherId: teacherId ?? (teachers?.some(({ id }) => id === sourceTeacher) ? sourceTeacher : ''),
    groupIds: classGroups.map(({ group }) => group.id),
    blocks: true,
    dates: true,
    students: false,
  };
}

/** As a new group, and at least one group to duplicate; the dates only go with the blocks. */
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
