import { maxLength, required, type SchemaPathTree, validate } from '@angular/forms/signals';

import {
  type ClassSubject,
  type GroupChanges,
  type ManagedGroup,
  MAX_GROUP_LABEL_LENGTH,
  type UserRef,
} from '../../data/group-service';

/**
 * A group of a class as its dialog edits it (5.2d): the name of its split and its teacher. Its
 * subject stays; new groups are added in «Añadir asignaturas».
 */
export interface GroupFormModel {
  /** Empty for the group of the whole class. */
  readonly label: string;
  readonly teacherId: string;
}

/** The group as it is. */
export function toGroupFormModel(managed: ManagedGroup): GroupFormModel {
  return { label: managed.group.label ?? '', teacherId: managed.group.teacherId };
}

/**
 * The teacher is required and a name is short. A class has each subject once per name (D-081):
 * without a name, the group is that of the whole class, which the subject may have already; with
 * one, it is not that of another split. `classSubjects` are the other groups of the class.
 */
export function groupSchema(classSubjects: readonly ClassSubject[], subjectId: string) {
  const same = classSubjects.filter((group) => group.subjectId === subjectId);
  return (path: SchemaPathTree<GroupFormModel>): void => {
    required(path.teacherId, { message: $localize`:@@groupForm.error.teacher:Elige el docente` });
    maxLength(path.label, MAX_GROUP_LABEL_LENGTH, {
      message: $localize`:@@groupForm.error.labelLength:Como mucho ${MAX_GROUP_LABEL_LENGTH}:max: caracteres`,
    });
    validate(path.label, ({ value }) => {
      const label = value().trim() || null;
      if (!same.some((group) => group.label === label)) return null;
      return label === null
        ? {
            kind: 'split',
            message: $localize`:@@groupForm.error.split:La clase ya tiene esta asignatura: ponle un nombre al desdoble`,
          }
        : {
            kind: 'taken',
            message: $localize`:@@groupForm.error.labelTaken:Ya hay un desdoble de esta asignatura con ese nombre`,
          };
    });
  };
}

/** What the service is asked for: the name without surrounding spaces, or none. */
export function toGroupChanges(model: GroupFormModel): GroupChanges {
  return { label: model.label.trim() || null, teacherId: model.teacherId };
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
