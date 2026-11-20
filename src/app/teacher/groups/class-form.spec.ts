import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import type { ClassDraft } from '../../data/group-service';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { CLASSES, TEACHER_ID } from '../../data/mock/fixtures/users';
import {
  type ClassFormModel,
  classSchema,
  existingClass,
  MAX_CLASS_NAME_LENGTH,
  newClassSchema,
  toClassDraft,
  toClassFormModel,
} from './class-form';

const DAW = CLASSES[0];

const VALID: ClassFormModel = {
  name: '2.º DAW A',
  schoolYear: '2026/27',
  subjectIds: [BASIC_PROGRAMMING_ID],
  teacherId: TEACHER_ID,
};

type Field = keyof ClassFormModel;

function errorsOf(
  model: ClassFormModel,
  schema = newClassSchema(CLASSES),
): Record<Field, string[]> {
  const classForm = form(signal(model), schema, { injector: TestBed.inject(Injector) });
  const keys: Field[] = ['name', 'schoolYear', 'subjectIds', 'teacherId'];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      classForm[key]()
        .errors()
        .map((error) => error.message ?? ''),
    ]),
  ) as Record<Field, string[]>;
}

function draftErrors(draft: ClassDraft): Record<'name' | 'schoolYear', string[]> {
  const classForm = form(signal(draft), classSchema, { injector: TestBed.inject(Injector) });
  return {
    name: classForm
      .name()
      .errors()
      .map((error) => error.message ?? ''),
    schoolYear: classForm
      .schoolYear()
      .errors()
      .map((error) => error.message ?? ''),
  };
}

describe('toClassFormModel', () => {
  const defaults = { schoolYear: '2026/27', teacherId: TEACHER_ID };

  it('starts a new class with the year and teacher given', () => {
    expect(toClassFormModel(null, defaults)).toEqual({
      name: '',
      schoolYear: '2026/27',
      subjectIds: [],
      teacherId: TEACHER_ID,
    });
  });

  it('leaves the teacher to choose without one', () => {
    expect(toClassFormModel(null, { ...defaults, teacherId: undefined }).teacherId).toBe('');
  });

  it('takes the name and year of a class', () => {
    expect(toClassFormModel(DAW, { schoolYear: '2030/31', teacherId: undefined })).toEqual({
      name: '1.º DAW A',
      schoolYear: '2026/27',
      subjectIds: [],
      teacherId: '',
    });
  });
});

describe('classSchema', () => {
  it('takes a valid class', () => {
    expect(draftErrors({ name: '1.º DAW A', schoolYear: '2026/27' })).toEqual({
      name: [],
      schoolYear: [],
    });
  });

  it('requires the name and the year', () => {
    expect(draftErrors({ name: '', schoolYear: '' })).toEqual({
      name: ['Escribe el nombre de la clase'],
      schoolYear: ['Escribe el curso'],
    });
  });

  it('checks the length of the name and the shape of the year', () => {
    expect(
      draftErrors({ name: 'x'.repeat(MAX_CLASS_NAME_LENGTH + 1), schoolYear: '2026-27' }),
    ).toEqual({
      name: [`Como mucho ${MAX_CLASS_NAME_LENGTH} caracteres`],
      schoolYear: ['Escribe el curso como 2026/27'],
    });
  });

  it('refuses a name of only spaces and a year of years apart', () => {
    expect(draftErrors({ name: '   ', schoolYear: '2026/99' })).toEqual({
      name: ['Escribe el nombre de la clase'],
      schoolYear: ['Un curso son dos años seguidos, como 2026/27'],
    });
  });
});

describe('newClassSchema', () => {
  it('takes a new class with its subjects, or without any', () => {
    expect(Object.values(errorsOf(VALID)).flat()).toEqual([]);
    expect(Object.values(errorsOf({ ...VALID, subjectIds: [], teacherId: '' })).flat()).toEqual([]);
  });

  it('checks the name and year as a class', () => {
    expect(errorsOf({ ...VALID, name: '' }).name).toEqual(['Escribe el nombre de la clase']);
  });

  it('requires the teacher of the groups while there are subjects', () => {
    expect(errorsOf({ ...VALID, teacherId: '' }).teacherId).toEqual(['Elige el docente']);
  });

  it('requires a subject to join a class that exists', () => {
    const joining = { ...VALID, name: ' 1.º daw a ', subjectIds: [] };
    expect(errorsOf(joining).subjectIds).toEqual(['Elige las asignaturas que das en ella']);
    expect(errorsOf(joining, newClassSchema([])).subjectIds).toEqual([]);
  });
});

describe('toClassDraft', () => {
  it('trims the name and the year, and leaves the rest out', () => {
    expect(toClassDraft({ ...VALID, name: ' 2.º DAW A ', schoolYear: '2026/27 ' })).toEqual({
      name: '2.º DAW A',
      schoolYear: '2026/27',
    });
  });
});

describe('existingClass', () => {
  it('finds the class of that name, whatever its capitals and spaces, and year', () => {
    expect(existingClass(CLASSES, { name: ' 1.º daw a', schoolYear: '2026/27 ' })).toBe(DAW);
  });

  it('is null for another year or another name', () => {
    expect(existingClass(CLASSES, { name: '1.º DAW A', schoolYear: '2027/28' })).toBeNull();
    expect(existingClass(CLASSES, { name: '2.º DAW A', schoolYear: '2026/27' })).toBeNull();
  });
});
