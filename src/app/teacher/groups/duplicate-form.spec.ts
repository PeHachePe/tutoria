import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import type { ManagedGroup } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CLASSES, GROUPS } from '../../data/mock/fixtures/users';
import {
  type DuplicateFormModel,
  duplicateSchema,
  toDuplicateFormModel,
  toDuplicateOptions,
} from './duplicate-form';

const TODAY = new Date(2026, 10, 19);
const DAW = CLASSES[0];

function managed(index: number): ManagedGroup {
  return {
    group: GROUPS[index],
    subject: SUBJECTS[0],
    teacherName: 'Marta',
    studentCount: 0,
    started: false,
    mine: true,
  };
}

function formOf(model: DuplicateFormModel) {
  return form(signal(model), duplicateSchema, { injector: TestBed.inject(Injector) });
}

describe('toDuplicateFormModel', () => {
  it('keeps the name, goes to the next year and takes every group with its blocks', () => {
    expect(toDuplicateFormModel(DAW, [managed(0), managed(2)], TODAY)).toEqual({
      name: '1.º DAW A',
      schoolYear: '2027/28',
      groupIds: [GROUPS[0].id, GROUPS[2].id],
      blocks: true,
      dates: true,
      students: false,
    });
  });
});

describe('duplicateSchema', () => {
  const model = toDuplicateFormModel(DAW, [managed(0)], TODAY);

  it('takes a class with a group', () => {
    const duplicateForm = formOf(model);
    expect(duplicateForm().valid()).toBe(true);
    expect(duplicateForm.dates().disabled()).toBe(false);
  });

  it('checks the class and asks for a group at least', () => {
    const duplicateForm = formOf({ ...model, name: '', groupIds: [] });
    expect(
      duplicateForm
        .name()
        .errors()
        .map(({ message }) => message),
    ).toEqual(['Escribe el nombre de la clase']);
    expect(
      duplicateForm
        .groupIds()
        .errors()
        .map(({ message }) => message),
    ).toEqual(['Elige al menos una asignatura']);
  });

  it('brings the dates only with the blocks', () => {
    expect(
      formOf({ ...model, blocks: false })
        .dates()
        .disabled(),
    ).toBe(true);
  });
});

describe('toDuplicateOptions', () => {
  const model = toDuplicateFormModel(DAW, [], TODAY);

  it('brings no dates without the blocks', () => {
    expect(toDuplicateOptions({ ...model, blocks: false })).toEqual({
      blocks: false,
      dates: false,
      students: false,
    });
  });

  it('brings what was chosen', () => {
    expect(toDuplicateOptions({ ...model, students: true })).toEqual({
      blocks: true,
      dates: true,
      students: true,
    });
    expect(toDuplicateOptions({ ...model, dates: false })).toEqual({
      blocks: true,
      dates: false,
      students: false,
    });
  });
});
