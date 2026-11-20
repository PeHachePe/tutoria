import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { type ManagedGroup, MAX_GROUP_LABEL_LENGTH } from '../../data/group-service';
import {
  ADVANCED_PROGRAMMING_ID,
  BASIC_PROGRAMMING_ID,
  SUBJECTS,
} from '../../data/mock/fixtures/subjects';
import { GROUPS, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import {
  type GroupFormModel,
  groupSchema,
  teacherChoices,
  toGroupDraft,
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

const VALID: GroupFormModel = {
  subjectId: ADVANCED_PROGRAMMING_ID,
  label: '',
  teacherId: TEACHER_ID,
};

type Field = keyof GroupFormModel;

function errorsOf(
  model: GroupFormModel,
  siblings: readonly ManagedGroup[] = [DAW, ENGLISH],
): Record<Field, string[]> {
  const groupForm = form(signal(model), groupSchema(siblings), {
    injector: TestBed.inject(Injector),
  });
  const keys: Field[] = ['subjectId', 'label', 'teacherId'];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      groupForm[key]()
        .errors()
        .map((error) => error.message ?? ''),
    ]),
  ) as Record<Field, string[]>;
}

describe('toGroupFormModel', () => {
  it('starts a new group of the teacher given', () => {
    expect(toGroupFormModel(null, TEACHER_ID)).toEqual({
      subjectId: '',
      label: '',
      teacherId: TEACHER_ID,
    });
  });

  it('leaves the teacher to choose without one', () => {
    expect(toGroupFormModel(null, undefined).teacherId).toBe('');
  });

  it('takes the subject, label and teacher of a group, not the teacher given', () => {
    expect(toGroupFormModel(DAW, OTHER_TEACHER_ID)).toEqual({
      subjectId: BASIC_PROGRAMMING_ID,
      label: '',
      teacherId: TEACHER_ID,
    });
    expect(toGroupFormModel(ENGLISH, undefined)).toEqual({
      subjectId: BASIC_PROGRAMMING_ID,
      label: 'Desdoble inglés',
      teacherId: OTHER_TEACHER_ID,
    });
  });
});

describe('groupSchema', () => {
  it('takes a subject the class does not have, without a label or with one', () => {
    expect(Object.values(errorsOf(VALID)).flat()).toEqual([]);
    expect(Object.values(errorsOf({ ...VALID, label: 'Tarde' }, [])).flat()).toEqual([]);
  });

  it('requires the subject and the teacher', () => {
    expect(errorsOf({ subjectId: '', label: '', teacherId: '' })).toEqual({
      subjectId: ['Elige la asignatura'],
      label: [],
      teacherId: ['Elige el docente'],
    });
  });

  it('keeps a label short', () => {
    expect(errorsOf({ ...VALID, label: 'x'.repeat(MAX_GROUP_LABEL_LENGTH + 1) }).label).toEqual([
      `Como mucho ${MAX_GROUP_LABEL_LENGTH} caracteres`,
    ]);
  });

  it('asks for the label of a split of a subject the class has', () => {
    const split = { ...VALID, subjectId: BASIC_PROGRAMMING_ID, label: '  ' };
    expect(errorsOf(split).label).toEqual([
      'La clase ya tiene esta asignatura: ponle un nombre al desdoble',
    ]);
    expect(errorsOf({ ...split, label: 'Desdoble 3' }).label).toEqual([]);
  });

  it('refuses the label of another split of the subject', () => {
    const taken = { ...VALID, subjectId: BASIC_PROGRAMMING_ID, label: ' Desdoble inglés ' };
    expect(errorsOf(taken).label).toEqual(['Ya hay un desdoble de esta asignatura con ese nombre']);
    // Without the split among its siblings, as when that split is the group edited
    expect(errorsOf(taken, [DAW]).label).toEqual([]);
  });
});

describe('toGroupDraft', () => {
  it('trims the label, and leaves none when it is blank', () => {
    expect(toGroupDraft({ ...VALID, label: ' Tarde ' })).toEqual({
      subjectId: ADVANCED_PROGRAMMING_ID,
      label: 'Tarde',
      teacherId: TEACHER_ID,
    });
    expect(toGroupDraft({ ...VALID, label: '   ' }).label).toBeNull();
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
