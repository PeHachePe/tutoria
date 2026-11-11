import type { AppLocale } from '../core/i18n/locale';
import {
  exerciseText,
  type ExerciseLocale,
  type ExerciseText,
  type TranslatableExercise,
} from './exercise-text';

const SPANISH: ExerciseText = {
  title: 'Suma de los elementos de un vector',
  statement: 'Escribe una función `sum`…',
  topics: ['Vectores', 'acumulador'],
};

const ENGLISH: ExerciseText = {
  title: 'Sum of the elements of an array',
  statement: 'Write a function `sum`…',
  topics: ['Arrays', 'accumulator'],
};

const EXERCISE: TranslatableExercise = {
  ...SPANISH,
  sourceLocale: 'es',
  translations: { en: ENGLISH },
};

describe('exerciseText', () => {
  it('speaks the languages of the interface', () => {
    expectTypeOf<ExerciseLocale>().toEqualTypeOf<AppLocale>();
  });

  it('gives the source texts in the source language', () => {
    expect(exerciseText(EXERCISE, 'es')).toEqual({ ...SPANISH, locale: 'es' });
  });

  it('gives the translation of the language asked for', () => {
    expect(exerciseText(EXERCISE, 'en')).toEqual({ ...ENGLISH, locale: 'en' });
  });

  it('falls back to the source texts, in their language, without a translation', () => {
    expect(exerciseText(EXERCISE, 'ca')).toEqual({ ...SPANISH, locale: 'es' });
  });

  it('works with any source language', () => {
    const english: TranslatableExercise = {
      ...ENGLISH,
      sourceLocale: 'en',
      translations: { es: SPANISH },
    };

    expect(exerciseText(english, 'es')).toEqual({ ...SPANISH, locale: 'es' });
    expect(exerciseText(english, 'ca')).toEqual({ ...ENGLISH, locale: 'en' });
  });
});
