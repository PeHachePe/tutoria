import { applyEach, required, type SchemaPathTree, validate } from '@angular/forms/signals';

import {
  type ClassSubject,
  type GroupDraft,
  MAX_GROUP_LABEL_LENGTH,
} from '../../data/group-service';
import type { AppLocale } from '../../core/i18n/locale';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';

/**
 * One subject of the school in «Añadir asignaturas» (5.2d, D-081): whether it is chosen and, if so,
 * whether it is the group of the whole class or a split, with its name.
 */
export interface SubjectPick {
  readonly subjectId: string;
  readonly chosen: boolean;
  readonly split: boolean;
  /** The name of the split; unused for the group of the whole class. */
  readonly label: string;
}

/** Every subject of the school, each with its choice, and the teacher of the new groups. */
export interface SubjectsFormModel {
  readonly picks: readonly SubjectPick[];
  readonly teacherId: string;
}

/** By name in the language of the interface: with twenty, one is found at a glance. */
export function sortSubjects(subjects: readonly Subject[], locale: AppLocale): Subject[] {
  const name = (subject: Subject) => subjectName(subject, locale).name;
  return [...subjects].sort((a, b) => name(a).localeCompare(name(b), locale));
}

/** Nothing chosen yet, for the teacher given (none for an administrator, who chooses). */
export function toSubjectsFormModel(
  subjects: readonly Subject[],
  teacherId: string | undefined,
): SubjectsFormModel {
  return {
    picks: subjects.map(({ id }) => ({ subjectId: id, chosen: false, split: false, label: '' })),
    teacherId: teacherId ?? '',
  };
}

/** The class has the group of the whole class of the subject: a new one of it is a split. */
export function hasWholeGroup(classSubjects: readonly ClassSubject[], subjectId: string): boolean {
  return classSubjects.some((group) => group.subjectId === subjectId && group.label === null);
}

/**
 * A subject at least, and the teacher. A split needs a short name of its own among the splits of its
 * subject in the class (D-081); the group of the whole class needs none. `classSubjects` reads the
 * groups of the class, which grow as the dialog adds them.
 */
export function subjectsSchema(classSubjects: () => readonly ClassSubject[]) {
  return (path: SchemaPathTree<SubjectsFormModel>): void => {
    validate(path.picks, ({ value }) =>
      value().some(({ chosen }) => chosen)
        ? null
        : {
            kind: 'required',
            message: $localize`:@@subjectsForm.error.none:Elige alguna asignatura`,
          },
    );
    required(path.teacherId, { message: $localize`:@@groupForm.error.teacher:Elige el docente` });
    applyEach(path.picks, (pick) => {
      validate(pick.label, ({ value, valueOf }) => {
        if (!valueOf(pick.chosen) || !valueOf(pick.split)) return null;
        const label = value().trim();
        if (label === '') {
          return {
            kind: 'required',
            message: $localize`:@@groupForm.error.splitName:Ponle un nombre al desdoble`,
          };
        }
        if (label.length > MAX_GROUP_LABEL_LENGTH) {
          return {
            kind: 'maxLength',
            message: $localize`:@@groupForm.error.labelLength:Como mucho ${MAX_GROUP_LABEL_LENGTH}:max: caracteres`,
          };
        }
        const subjectId = valueOf(pick.subjectId);
        return classSubjects().some(
          (group) => group.subjectId === subjectId && group.label === label,
        )
          ? {
              kind: 'taken',
              message: $localize`:@@groupForm.error.labelTaken:Ya hay un desdoble de esta asignatura con ese nombre`,
            }
          : null;
      });
    });
  };
}

/** What the service is asked for: a group for each subject chosen, in the order of the list. */
export function toGroupDrafts(model: SubjectsFormModel): GroupDraft[] {
  return model.picks
    .filter(({ chosen }) => chosen)
    .map(({ subjectId, split, label }) => ({
      subjectId,
      label: split ? label.trim() : null,
      teacherId: model.teacherId,
    }));
}
