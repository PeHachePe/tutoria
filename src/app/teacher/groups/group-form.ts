import { maxLength, pattern, required, type SchemaPathTree } from '@angular/forms/signals';

import { type GroupDraft, type ManagedGroup, SCHOOL_YEAR_PATTERN } from '../../data/group-service';

/** Enough for «2.º DAW A · Mañanas»: the name goes in the header of its panel. */
export const MAX_GROUP_NAME_LENGTH = 60;

/** A group as its dialog edits it (5.2b). */
export interface GroupFormModel {
  readonly name: string;
  readonly schoolYear: string;
  readonly subjectId: string;
  readonly teacherId: string;
}

export interface GroupFormDefaults {
  /** The current one, from `schoolYearOf()`. */
  readonly schoolYear: string;
  /** The only subject there is, or empty to choose one. */
  readonly subjectId: string;
  /** A teacher's groups are their own; an administrator chooses one (none, undefined). */
  readonly teacherId: string | undefined;
}

/** The group to edit, or a new one with the defaults. */
export function toGroupFormModel(
  managed: ManagedGroup | null,
  defaults: GroupFormDefaults,
): GroupFormModel {
  if (!managed) return { name: '', ...defaults, teacherId: defaults.teacherId ?? '' };
  const { name, schoolYear, subjectId, teacherId } = managed.group;
  return { name, schoolYear, subjectId, teacherId };
}

/** Everything is required, and the year is like `2026/27`, as the database checks it. */
export function groupSchema(path: SchemaPathTree<GroupFormModel>): void {
  required(path.name, { message: $localize`:@@groupForm.error.name:Escribe el nombre del grupo` });
  maxLength(path.name, MAX_GROUP_NAME_LENGTH, {
    message: $localize`:@@groupForm.error.nameLength:Como mucho ${MAX_GROUP_NAME_LENGTH}:max: caracteres`,
  });
  required(path.schoolYear, { message: $localize`:@@groupForm.error.year:Escribe el curso` });
  pattern(path.schoolYear, SCHOOL_YEAR_PATTERN, {
    message: $localize`:@@groupForm.error.yearFormat:Escribe el curso como 2026/27`,
  });
  required(path.subjectId, {
    message: $localize`:@@groupForm.error.subject:Elige la asignatura`,
  });
  required(path.teacherId, { message: $localize`:@@groupForm.error.teacher:Elige el docente` });
}

/** What is saved: the texts without surrounding spaces, and the id of an existing group. */
export function toGroupDraft(model: GroupFormModel, groupId?: string): GroupDraft {
  return {
    ...(groupId === undefined ? {} : { id: groupId }),
    name: model.name.trim(),
    schoolYear: model.schoolYear.trim(),
    subjectId: model.subjectId,
    teacherId: model.teacherId,
  };
}
