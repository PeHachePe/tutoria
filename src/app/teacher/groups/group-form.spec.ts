import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { type ManagedGroup, MAX_GROUP_LABEL_LENGTH } from '../../data/group-service';
import { BASIC_PROGRAMMING_ID, SUBJECTS } from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { classSubjectsOf } from './class-list';
import {
  type GroupFormModel,
  groupSchema,
  teacherChoices,
  toGroupChanges,
  toGroupFormModel,
} from './group-form';

/** 1.º DAW A in basic programming, the group of the whole class. */
const DAW: ManagedGroup = {
  group: GROUPS[0],
  subject: SUBJECTS[0],
  teacherName: 'Marta',
  studentCount: 24,
  started: true,
  mine: true,
};

/** Its split in English, of another teacher. */
const ENGLISH: ManagedGroup = {
  group: GROUPS[4],
  subject: SUBJECTS[0],
  teacherName: 'Javier',
  studentCount: 0,
  started: false,
  mine: false,
};

/** The errors of the name and the teacher of a group of basic programming, among the others given. */
function errorsOf(
  model: GroupFormModel,
  others: readonly ManagedGroup[],
): Record<keyof GroupFormModel, string[]> {
  const groupForm = form(
    signal(model),
    groupSchema(classSubjectsOf(others), BASIC_PROGRAMMING_ID),
    {
      injector: TestBed.inject(Injector),
    },
  );
  return {
    label: groupForm
      .label()
      .errors()
      .map((error) => error.message ?? ''),
    teacherId: groupForm
      .teacherId()
      .errors()
      .map((error) => error.message ?? ''),
  };
}

describe('toGroupFormModel', () => {
  it('takes the name and teacher of a group', () => {
    expect(toGroupFormModel(DAW)).toEqual({ label: '', teacherId: TEACHER_ID });
    expect(toGroupFormModel(ENGLISH)).toEqual({
      label: 'Desdoble inglés',
      teacherId: OTHER_TEACHER_ID,
    });
  });
});

describe('groupSchema', () => {
  it('takes a group without a name, or with one of its own', () => {
    expect(errorsOf({ label: '', teacherId: TEACHER_ID }, [ENGLISH])).toEqual({
      label: [],
      teacherId: [],
    });
    expect(
      errorsOf({ label: 'Desdoble tarde', teacherId: TEACHER_ID }, [DAW, ENGLISH]).label,
    ).toEqual([]);
  });

  it('requires the teacher and keeps a name short', () => {
    expect(errorsOf({ label: 'x'.repeat(MAX_GROUP_LABEL_LENGTH + 1), teacherId: '' }, [])).toEqual({
      label: [`Como mucho ${MAX_GROUP_LABEL_LENGTH} caracteres`],
      teacherId: ['Elige el docente'],
    });
  });

  it('keeps the name of a split while the class has the group of the whole class', () => {
    expect(errorsOf({ label: '  ', teacherId: TEACHER_ID }, [DAW]).label).toEqual([
      'La clase ya tiene esta asignatura: ponle un nombre al desdoble',
    ]);
  });

  it('refuses the name of another split of the subject', () => {
    expect(
      errorsOf({ label: ' Desdoble inglés ', teacherId: TEACHER_ID }, [DAW, ENGLISH]).label,
    ).toEqual(['Ya hay un desdoble de esta asignatura con ese nombre']);
  });
});

describe('toGroupChanges', () => {
  it('trims the name, and leaves none when it is blank', () => {
    expect(toGroupChanges({ label: ' Tarde ', teacherId: TEACHER_ID })).toEqual({
      label: 'Tarde',
      teacherId: TEACHER_ID,
    });
    expect(toGroupChanges({ label: '   ', teacherId: TEACHER_ID }).label).toBeNull();
  });
});

describe('teacherChoices', () => {
  const marta = { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' };

  it('offers the active teachers', () => {
    expect(teacherChoices([marta], null)).toEqual([{ ...marta, disabled: false }]);
    expect(teacherChoices([marta], DAW)).toEqual([{ ...marta, disabled: false }]);
  });

  it('keeps the disabled teacher of a group, which cannot be chosen again', () => {
    expect(teacherChoices([marta], ENGLISH)).toEqual([
      { ...marta, disabled: false },
      { id: OTHER_TEACHER_ID, name: 'Javier (cuenta desactivada)', email: '', disabled: true },
    ]);
  });
});
