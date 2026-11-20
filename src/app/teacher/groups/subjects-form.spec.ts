import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { type ClassSubject, MAX_GROUP_LABEL_LENGTH } from '../../data/group-service';
import {
  ADVANCED_PROGRAMMING_ID,
  BASIC_PROGRAMMING_ID,
  SUBJECTS,
  WEB_CLIENT_ID,
} from '../../data/mock/fixtures/subjects';
import { TEACHER_ID } from '../../data/mock/fixtures/users';
import {
  hasWholeGroup,
  type SubjectsFormModel,
  sortSubjects,
  subjectsSchema,
  toGroupDrafts,
  toSubjectsFormModel,
} from './subjects-form';

/** 1.º DAW A: basic programming for the whole class, with its split in English. */
const CLASS_SUBJECTS: ClassSubject[] = [
  { subjectId: BASIC_PROGRAMMING_ID, label: null, teacherName: 'Marta' },
  { subjectId: BASIC_PROGRAMMING_ID, label: 'Desdoble inglés', teacherName: 'Javier' },
];

/** The model of the seed's subjects, with the choices given by subject. */
function modelWith(
  choices: Record<string, { split?: boolean; label?: string }>,
  teacherId = TEACHER_ID,
): SubjectsFormModel {
  const model = toSubjectsFormModel(SUBJECTS, teacherId);
  return {
    ...model,
    picks: model.picks.map((pick) =>
      choices[pick.subjectId] ? { ...pick, chosen: true, ...choices[pick.subjectId] } : pick,
    ),
  };
}

function formOf(model: SubjectsFormModel, classSubjects = CLASS_SUBJECTS) {
  return form(
    signal(model),
    subjectsSchema(() => classSubjects),
    {
      injector: TestBed.inject(Injector),
    },
  );
}

function messages(errors: readonly { message?: string }[]): string[] {
  return errors.map(({ message }) => message ?? '');
}

describe('sortSubjects', () => {
  it('orders by name in the language of the interface, without changing the list given', () => {
    const few = SUBJECTS.slice(0, 3);
    expect(sortSubjects(few, 'es').map(({ name }) => name)).toEqual([
      'Desarrollo web en entorno cliente',
      'Programación avanzada',
      'Programación básica',
    ]);
    // In English «Advanced programming» goes first
    expect(sortSubjects(few, 'en')[0].id).toBe(ADVANCED_PROGRAMMING_ID);
    expect(few[0].id).toBe(BASIC_PROGRAMMING_ID);
  });
});

describe('toSubjectsFormModel', () => {
  it('lists every subject unchosen, for the teacher given or none', () => {
    const model = toSubjectsFormModel(SUBJECTS, TEACHER_ID);
    expect(model.teacherId).toBe(TEACHER_ID);
    expect(model.picks).toEqual(
      SUBJECTS.map(({ id }) => ({ subjectId: id, chosen: false, split: false, label: '' })),
    );
    expect(toSubjectsFormModel(SUBJECTS, undefined).teacherId).toBe('');
  });
});

describe('hasWholeGroup', () => {
  it('tells a subject with the group of the whole class from one with only splits', () => {
    expect(hasWholeGroup(CLASS_SUBJECTS, BASIC_PROGRAMMING_ID)).toBe(true);
    expect(hasWholeGroup(CLASS_SUBJECTS.slice(1), BASIC_PROGRAMMING_ID)).toBe(false);
    expect(hasWholeGroup(CLASS_SUBJECTS, WEB_CLIENT_ID)).toBe(false);
  });
});

describe('subjectsSchema', () => {
  it('needs a subject and the teacher', () => {
    const subjectsForm = formOf(modelWith({}, ''));
    expect(messages(subjectsForm.picks().errors())).toEqual(['Elige alguna asignatura']);
    expect(messages(subjectsForm.teacherId().errors())).toEqual(['Elige el docente']);
  });

  it('takes groups of the whole class and splits together', () => {
    const subjectsForm = formOf(
      modelWith({
        [ADVANCED_PROGRAMMING_ID]: {},
        [BASIC_PROGRAMMING_ID]: { split: true, label: 'Desdoble 2' },
      }),
    );
    expect(subjectsForm().valid()).toBe(true);
  });

  it('asks a split for a short name of its own', () => {
    const index = SUBJECTS.findIndex(({ id }) => id === BASIC_PROGRAMMING_ID);
    const labelOf = (label: string) =>
      messages(
        formOf(modelWith({ [BASIC_PROGRAMMING_ID]: { split: true, label } }))
          .picks[index].label()
          .errors(),
      );
    expect(labelOf('  ')).toEqual(['Ponle un nombre al desdoble']);
    expect(labelOf('x'.repeat(MAX_GROUP_LABEL_LENGTH + 1))).toEqual([
      `Como mucho ${MAX_GROUP_LABEL_LENGTH} caracteres`,
    ]);
    expect(labelOf(' Desdoble inglés ')).toEqual([
      'Ya hay un desdoble de esta asignatura con ese nombre',
    ]);
    expect(labelOf('Desdoble tarde')).toEqual([]);
  });

  it('does not look at the name of the group of the whole class, or of one unchosen', () => {
    const subjectsForm = formOf(
      modelWith({ [ADVANCED_PROGRAMMING_ID]: { split: false, label: '' } }),
    );
    expect(subjectsForm().valid()).toBe(true);
    const model = toSubjectsFormModel(SUBJECTS, TEACHER_ID);
    const unchosen = formOf({
      ...model,
      picks: model.picks.map((pick) => ({ ...pick, split: true })),
    });
    expect(unchosen.picks[0].label().errors()).toEqual([]);
  });
});

describe('toGroupDrafts', () => {
  it('a group for each subject chosen, in the order of the list, the name trimmed', () => {
    expect(
      toGroupDrafts(
        modelWith({
          [WEB_CLIENT_ID]: { label: 'unused' },
          [BASIC_PROGRAMMING_ID]: { split: true, label: ' Desdoble 2 ' },
        }),
      ),
    ).toEqual([
      { subjectId: BASIC_PROGRAMMING_ID, label: 'Desdoble 2', teacherId: TEACHER_ID },
      { subjectId: WEB_CLIENT_ID, label: null, teacherId: TEACHER_ID },
    ]);
  });
});
