import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { GROUPS, TEACHER_ID } from '../../data/mock/fixtures/users';
import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import {
  type GroupFormModel,
  groupSchema,
  MAX_GROUP_NAME_LENGTH,
  teacherChoices,
  toClassDraft,
  toGroupFormModel,
} from './group-form';

const DEFAULTS = { schoolYear: '2026/27', subjectIds: [], teacherId: TEACHER_ID };

const VALID: GroupFormModel = {
  name: '2.º DAW A',
  schoolYear: '2026/27',
  subjectIds: [BASIC_PROGRAMMING_ID],
  teacherId: TEACHER_ID,
};

const DAW: ManagedGroup = {
  group: GROUPS[0],
  subject: SUBJECTS[0],
  teacherName: 'Carmen',
  studentCount: 26,
  started: true,
};

function errorsOf(model: GroupFormModel): Record<string, string[]> {
  const groupForm = form(signal(model), groupSchema, { injector: TestBed.inject(Injector) });
  const keys = ['name', 'schoolYear', 'subjectIds', 'teacherId'] as const;
  return Object.fromEntries(
    keys.map((key) => [
      key,
      groupForm[key]()
        .errors()
        .map((error) => error.message ?? ''),
    ]),
  );
}

describe('toGroupFormModel', () => {
  it('starts a new group with the defaults', () => {
    expect(toGroupFormModel(null, DEFAULTS)).toEqual({ name: '', ...DEFAULTS });
  });

  it('leaves the teacher to choose without one', () => {
    expect(toGroupFormModel(null, { ...DEFAULTS, teacherId: undefined }).teacherId).toBe('');
  });

  it('takes the fields of a group', () => {
    expect(toGroupFormModel(DAW, DEFAULTS)).toEqual({
      name: '1.º DAW A',
      schoolYear: '2026/27',
      subjectIds: [BASIC_PROGRAMMING_ID],
      teacherId: TEACHER_ID,
    });
  });
});

describe('groupSchema', () => {
  it('takes a valid group', () => {
    expect(Object.values(errorsOf(VALID)).flat()).toEqual([]);
  });

  it('requires every field', () => {
    expect(errorsOf({ name: '', schoolYear: '', subjectIds: [], teacherId: '' })).toEqual({
      name: ['Escribe el nombre del grupo'],
      schoolYear: ['Escribe el curso'],
      subjectIds: ['Elige la asignatura'],
      teacherId: ['Elige el docente'],
    });
  });

  it('checks the shape of the year and the length of the name', () => {
    const errors = errorsOf({
      ...VALID,
      name: 'x'.repeat(MAX_GROUP_NAME_LENGTH + 1),
      schoolYear: '2026-27',
    });
    expect(errors['name']).toEqual([`Como mucho ${MAX_GROUP_NAME_LENGTH} caracteres`]);
    expect(errors['schoolYear']).toEqual(['Escribe el curso como 2026/27']);
  });
});

describe('groupSchema, beyond the shape', () => {
  it('refuses a name of only spaces and a year of years apart', () => {
    const errors = errorsOf({ ...VALID, name: '   ', schoolYear: '2026/99' });
    expect(errors['name']).toEqual(['Escribe el nombre del grupo']);
    expect(errors['schoolYear']).toEqual(['Un curso son dos años seguidos, como 2026/27']);
  });
});

describe('teacherChoices', () => {
  const marta = { id: TEACHER_ID, name: 'Marta', email: 'marta@tutoria.test' };

  it('offers the active teachers', () => {
    expect(teacherChoices([marta], null)).toEqual([{ ...marta, disabled: false }]);
    expect(teacherChoices([marta], DAW)).toEqual([{ ...marta, disabled: false }]);
  });

  it('keeps the disabled teacher of a group, which cannot be chosen again', () => {
    expect(teacherChoices([], DAW)).toEqual([
      { id: TEACHER_ID, name: 'Carmen (cuenta desactivada)', email: '', disabled: true },
    ]);
  });
});

describe('toClassDraft', () => {
  it('trims the texts and leaves the subjects out', () => {
    expect(toClassDraft({ ...VALID, name: ' 2.º DAW A ', schoolYear: '2026/27 ' })).toEqual({
      name: '2.º DAW A',
      schoolYear: '2026/27',
      teacherId: TEACHER_ID,
    });
  });
});
