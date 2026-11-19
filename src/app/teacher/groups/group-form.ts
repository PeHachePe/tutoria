import {
  maxLength,
  pattern,
  required,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import {
  type ClassDraft,
  type ManagedGroup,
  SCHOOL_YEAR_PATTERN,
  type UserRef,
} from '../../data/group-service';
import { isSchoolYear } from './school-year';

/** Enough for «2.º DAW A · Mañanas»: the name goes in the header of its panel. */
export const MAX_GROUP_NAME_LENGTH = 60;

/** A group as its dialog edits it (5.2b), or a class as it is created in several subjects (5.2c). */
export interface GroupFormModel {
  readonly name: string;
  readonly schoolYear: string;
  /** A group of each, when it is created; that of the group, which never changes, when edited. */
  readonly subjectIds: readonly string[];
  readonly teacherId: string;
}

export interface GroupFormDefaults {
  /** The current one, from `schoolYearOf()`. */
  readonly schoolYear: string;
  /** The only subject there is, or none to choose them. */
  readonly subjectIds: readonly string[];
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
  return { name, schoolYear, subjectIds: [subjectId], teacherId };
}

/** Everything is required, and the year is like `2026/27`, as the database checks it. */
export function groupSchema(path: SchemaPathTree<GroupFormModel>): void {
  classSchema(path);
  // `required` takes an empty list as a value
  validate(path.subjectIds, ({ value }) =>
    value().length === 0
      ? {
          kind: 'required',
          message: $localize`:@@groupForm.error.subject:Elige la asignatura`,
        }
      : null,
  );
}

/**
 * What every group of a class shares: the name, the year and the teacher (5.2c). Also the schema of
 * duplicating a class.
 */
export function classSchema(
  path: SchemaPathTree<Pick<GroupFormModel, 'name' | 'schoolYear' | 'teacherId'>>,
): void {
  required(path.name, { message: $localize`:@@groupForm.error.name:Escribe el nombre del grupo` });
  maxLength(path.name, MAX_GROUP_NAME_LENGTH, {
    message: $localize`:@@groupForm.error.nameLength:Como mucho ${MAX_GROUP_NAME_LENGTH}:max: caracteres`,
  });
  // Only spaces is no name: the server would refuse it with a generic error
  validate(path.name, ({ value }) =>
    value() !== '' && value().trim() === ''
      ? { kind: 'blank', message: $localize`:@@groupForm.error.name:Escribe el nombre del grupo` }
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
  required(path.teacherId, { message: $localize`:@@groupForm.error.teacher:Elige el docente` });
}

/** What the groups of the class share, with the texts without surrounding spaces. */
export function toClassDraft(
  model: Pick<GroupFormModel, 'name' | 'schoolYear' | 'teacherId'>,
): ClassDraft {
  return {
    name: model.name.trim(),
    schoolYear: model.schoolYear.trim(),
    teacherId: model.teacherId,
  };
}

/** A teacher the administrator can choose for a group; the current one may be disabled. */
export interface TeacherChoice extends UserRef {
  readonly disabled: boolean;
}

/**
 * The active teachers and, if the group's teacher is no longer one of them, that teacher too, shown
 * but not chosen again: the group keeps it until the administration hands it over (D-072).
 */
export function teacherChoices(
  teachers: readonly UserRef[],
  managed: ManagedGroup | null,
): TeacherChoice[] {
  const choices = teachers.map((teacher) => ({ ...teacher, disabled: false }));
  if (!managed || teachers.some(({ id }) => id === managed.group.teacherId)) return choices;
  return [
    ...choices,
    {
      id: managed.group.teacherId,
      name: $localize`:@@groupForm.teacher.disabled:${managed.teacherName}:name: (cuenta desactivada)`,
      email: '',
      disabled: true,
    },
  ];
}
