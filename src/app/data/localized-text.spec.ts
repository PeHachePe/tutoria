import type { AppLocale } from '../core/i18n/locale';
import {
  exerciseText,
  type ContentLocale,
  type ExerciseText,
  type TranslatableExercise,
  blockTitle,
  subjectName,
} from './localized-text';
import type { ClassBlock } from './exercise';
import type { Subject } from './subject';

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
    expectTypeOf<ContentLocale>().toEqualTypeOf<AppLocale>();
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

describe('subjectName and blockTitle', () => {
  const subject: Subject = {
    id: 'subject-1',
    name: 'Programación básica',
    sourceLocale: 'es',
    translations: { en: { name: 'Basic programming' } },
  };
  const block: ClassBlock = {
    id: 'block-1',
    groupId: 'group-1',
    position: 1,
    title: 'Topic 1: Loops',
    sourceLocale: 'en',
    translations: { es: { title: 'Tema 1: Bucles' } },
    isHidden: false,
  };

  it('give the name of a subject in the language asked for, or the source one', () => {
    expect(subjectName(subject, 'en')).toEqual({ name: 'Basic programming', locale: 'en' });
    expect(subjectName(subject, 'ca')).toEqual({ name: 'Programación básica', locale: 'es' });
  });

  it('give the title of a block in the language asked for, or the source one', () => {
    expect(blockTitle(block, 'es')).toEqual({ title: 'Tema 1: Bucles', locale: 'es' });
    expect(blockTitle(block, 'en')).toEqual({ title: 'Topic 1: Loops', locale: 'en' });
    expect(blockTitle(block, 'ca')).toEqual({ title: 'Topic 1: Loops', locale: 'en' });
  });

  it('keep only the text, whatever else a stored translation brings', () => {
    const stored = { ...subject, translations: { en: { name: 'Basic', extra: 1 } as never } };

    expect(subjectName(stored, 'en')).toEqual({ name: 'Basic', locale: 'en' });
  });
});
