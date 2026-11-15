import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { emptyFormModel, type ExerciseFormModel, type TestRow } from './exercise-form-model';
import { exerciseSchema } from './exercise-form-schema';

const VALID: ExerciseFormModel = {
  ...emptyFormModel('es'),
  texts: {
    es: { title: 'Producto', statement: 'Escribe `product`.', topics: 'Vectores' },
    en: { title: '', statement: '', topics: '' },
    ca: { title: '', statement: '', topics: '' },
  },
  functionName: 'product',
  parameters: 'numbers',
  subjectIds: ['subject-1'],
  tests: [
    { input: '[2, 3]', expected: '6', isHidden: false },
    { input: '[]', expected: '1', isHidden: true },
  ],
};

function exerciseForm(model: ExerciseFormModel) {
  return form(signal(model), exerciseSchema, { injector: TestBed.inject(Injector) });
}

/** The messages of the errors of a field. */
function messages(field: () => { errors(): readonly { message?: string }[] }): string[] {
  return field()
    .errors()
    .map((error) => error.message ?? '');
}

describe('exerciseSchema', () => {
  it('accepts a complete exercise', () => {
    expect(exerciseForm(VALID)().valid()).toBe(true);
  });

  it('asks for the title and the statement of the original language', () => {
    const exercise = exerciseForm({
      ...VALID,
      sourceLocale: 'en',
    });

    expect(messages(exercise.texts.en.title)).toEqual(['Escribe el título']);
    expect(messages(exercise.texts.en.statement)).toEqual(['Escribe el enunciado']);
    expect(messages(exercise.texts.es.title)).toEqual([]);
  });

  it('leaves a translation optional, but complete once started', () => {
    const exercise = exerciseForm({
      ...VALID,
      texts: { ...VALID.texts, ca: { title: '', statement: '', topics: 'Vectors' } },
    });

    expect(messages(exercise.texts.ca.title)).toEqual(['Falta el título de la traducción']);
    expect(messages(exercise.texts.ca.statement)).toEqual(['Falta el enunciado de la traducción']);
    expect(messages(exercise.texts.en.title)).toEqual([]);
  });

  it('limits the length of the titles', () => {
    const exercise = exerciseForm({
      ...VALID,
      texts: { ...VALID.texts, es: { ...VALID.texts.es, title: 'a'.repeat(121) } },
    });

    expect(messages(exercise.texts.es.title)).toEqual(['Como mucho 120 caracteres']);
  });

  it('asks for a function named in plain letters, never with accents', () => {
    expect(messages(exerciseForm({ ...VALID, functionName: '' }).functionName)).toEqual([
      'Escribe el nombre de la función',
    ]);
    expect(
      messages(exerciseForm({ ...VALID, functionName: 'contar vocales' }).functionName),
    ).toEqual(['Un nombre sin espacios, tildes ni ñ, como countVowels']);
    expect(messages(exerciseForm({ ...VALID, functionName: ' sum ' }).functionName)).toEqual([]);
  });

  it('checks the names of the parameters', () => {
    const errorOf = (parameters: string) =>
      messages(exerciseForm({ ...VALID, parameters }).parameters);

    expect(errorOf('')).toEqual([]);
    expect(errorOf('items, size')).toEqual([]);
    expect(errorOf('año')).toEqual([
      'Nombres sin espacios, tildes ni ñ, separados por comas, como items, size',
    ]);
    expect(errorOf('a, a')).toEqual(['Cada parámetro necesita un nombre distinto']);
    expect(errorOf('a, b, c, d, e, f, g')).toEqual(['Como mucho 6 parámetros']);
  });

  it('asks for a subject, so the teachers of it find the exercise in the bank', () => {
    expect(messages(exerciseForm({ ...VALID, subjectIds: [] }).subjectIds)).toEqual([
      'Elige al menos una asignatura',
    ]);
  });

  it('keeps the thresholds within the sliders', () => {
    const exercise = exerciseForm({ ...VALID, maxRepeatedFailures: 0, maxIdleMinutes: 31 });

    expect(exercise.maxRepeatedFailures().valid()).toBe(false);
    expect(exercise.maxIdleMinutes().valid()).toBe(false);
  });

  it('asks for at least one test, and one the student can see', () => {
    expect(messages(exerciseForm({ ...VALID, tests: [] }).tests)).toEqual([
      'Añade al menos una prueba',
    ]);
    const hidden: TestRow = { input: '1', expected: '1', isHidden: true };
    expect(messages(exerciseForm({ ...VALID, tests: [hidden] }).tests)).toEqual([
      'Deja al menos una prueba visible: el alumno aprende de ella',
    ]);
  });

  it('asks for the arguments and the expected value of each test in JSON', () => {
    const exercise = exerciseForm({
      ...VALID,
      tests: [{ input: 'hola', expected: 'hola', isHidden: false }],
    });

    expect(messages(exercise.tests[0].input)).toEqual([
      'Escribe los argumentos en JSON, con los textos entre comillas',
    ]);
    expect(messages(exercise.tests[0].expected)).toEqual([
      'Escribe el valor en JSON, como 6, "hola" o [1, 2]',
    ]);
  });
});
