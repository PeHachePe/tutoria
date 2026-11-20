import { maxLength, required, type SchemaPathTree, validate } from '@angular/forms/signals';

import {
  type GroupDraft,
  type ManagedGroup,
  MAX_GROUP_LABEL_LENGTH,
  type UserRef,
} from '../../data/group-service';

/** A group of a class as its dialog edits it (5.2d): its subject, the label of a split, its teacher. */
export interface GroupFormModel {
  readonly subjectId: string;
  /** Empty for the group of the whole class. */
  readonly label: string;
  readonly teacherId: string;
}

/** The group to edit, or a new one of the teacher given (none for an administrator, who chooses). */
export function toGroupFormModel(
  managed: ManagedGroup | null,
  teacherId: string | undefined,
): GroupFormModel {
  if (!managed) return { subjectId: '', label: '', teacherId: teacherId ?? '' };
  const { subjectId, label, teacherId: current } = managed.group;
  return { subjectId, label: label ?? '', teacherId: current };
}

/**
 * The subject and the teacher are required, and a label is short. A class has each subject once
 * per label (D-081): a second group of one needs a label of its own, the label of a split.
 * `siblings` are the other groups of the class.
 */
export function groupSchema(siblings: readonly ManagedGroup[]) {
  return (path: SchemaPathTree<GroupFormModel>): void => {
    required(path.subjectId, {
      message: $localize`:@@groupForm.error.subject:Elige la asignatura`,
    });
    required(path.teacherId, { message: $localize`:@@groupForm.error.teacher:Elige el docente` });
    maxLength(path.label, MAX_GROUP_LABEL_LENGTH, {
      message: $localize`:@@groupForm.error.labelLength:Como mucho ${MAX_GROUP_LABEL_LENGTH}:max: caracteres`,
    });
    validate(path.label, ({ value, valueOf }) => {
      const label = value().trim() || null;
      const same = siblings.filter(({ group }) => group.subjectId === valueOf(path.subjectId));
      if (!same.some(({ group }) => group.label === label)) return null;
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

/** What the service is asked for: the label without surrounding spaces, or none. */
export function toGroupDraft(model: GroupFormModel): GroupDraft {
  return {
    subjectId: model.subjectId,
    label: model.label.trim() || null,
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
