import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import type { ClassDraft, SchoolClassEntry } from '../../data/group-service';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import { CLASSES } from '../../data/mock/fixtures/users';
import {
  classSchema,
  existingClass,
  existingEntry,
  MAX_CLASS_NAME_LENGTH,
  toClassDraft,
  toClassFormModel,
} from './class-form';

const DAW = CLASSES[0];

/** The classes of the seed; 1.º DAW A has basic programming for the whole class already. */
const ENTRIES: SchoolClassEntry[] = CLASSES.map((schoolClass, index) => ({
  schoolClass,
  groups:
    index === 0
      ? [{ subjectId: BASIC_PROGRAMMING_ID, label: null, teacherName: 'Marta Ibáñez Soler' }]
      : [],
}));

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
  it('starts a new class with the year given', () => {
    expect(toClassFormModel(null, '2026/27')).toEqual({ name: '', schoolYear: '2026/27' });
  });

  it('takes the name and year of a class', () => {
    expect(toClassFormModel(DAW, '2030/31')).toEqual({ name: '1.º DAW A', schoolYear: '2026/27' });
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

describe('toClassDraft', () => {
  it('trims the name and the year', () => {
    expect(toClassDraft({ name: ' 2.º DAW A ', schoolYear: '2026/27 ' })).toEqual({
      name: '2.º DAW A',
      schoolYear: '2026/27',
    });
  });
});

describe('existingEntry', () => {
  it('finds the entry of the class, with its groups', () => {
    const entry = existingEntry(ENTRIES, { name: '1.º daw a', schoolYear: '2026/27' });
    expect(entry).toBe(ENTRIES[0]);
    expect(entry?.groups[0].teacherName).toBe('Marta Ibáñez Soler');
  });

  it('is null for a class that does not exist', () => {
    expect(existingEntry(ENTRIES, { name: '9.º X', schoolYear: '2026/27' })).toBeNull();
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
