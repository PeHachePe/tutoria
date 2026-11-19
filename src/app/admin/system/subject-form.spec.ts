import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import type { Subject } from '../../data/subject';
import {
  SUBJECT_NAME_LENGTH,
  subjectSchema,
  takenSubjectNames,
  toSubjectDraft,
  toSubjectFormModel,
} from './subject-form';

const NO_NAMES = takenSubjectNames([], null);

const SUBJECT: Subject = {
  id: 'basic',
  name: 'Programación básica',
  sourceLocale: 'es',
  translations: { en: { name: 'Basic programming' } },
};

describe('toSubjectFormModel', () => {
  it('starts a new subject in the language of the interface', () => {
    expect(toSubjectFormModel(null, 'ca')).toEqual({
      sourceLocale: 'ca',
      names: { es: '', en: '', ca: '' },
    });
  });

  it('puts every name of a subject in its language', () => {
    expect(toSubjectFormModel(SUBJECT, 'en')).toEqual({
      sourceLocale: 'es',
      names: { es: 'Programación básica', en: 'Basic programming', ca: '' },
    });
  });
});

describe('toSubjectDraft', () => {
  it('keeps the id of the subject and the translations written, without spaces', () => {
    const model = toSubjectFormModel(SUBJECT, 'es');
    expect(
      toSubjectDraft(
        { ...model, names: { ...model.names, ca: ' Programació ', es: ' X ' } },
        'basic',
      ),
    ).toEqual({
      id: 'basic',
      name: 'X',
      sourceLocale: 'es',
      translations: { en: { name: 'Basic programming' }, ca: { name: 'Programació' } },
    });
  });

  it('has no id for a new subject', () => {
    expect(toSubjectDraft(toSubjectFormModel(null, 'es'), null)).not.toHaveProperty('id');
  });
});

describe('subjectSchema', () => {
  it('asks only for the name in the language it is written in', () => {
    const tree = TestBed.runInInjectionContext(() =>
      form(
        signal(toSubjectFormModel(null, 'en')),
        subjectSchema(() => NO_NAMES),
      ),
    );
    expect(
      tree.names
        .en()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['required']);
    expect(tree.names.es().errors()).toEqual([]);
  });

  it(`takes ${SUBJECT_NAME_LENGTH} characters at most`, () => {
    const long = 'x'.repeat(SUBJECT_NAME_LENGTH + 1);
    const tree = TestBed.runInInjectionContext(() =>
      form(
        signal({ sourceLocale: 'es' as const, names: { es: 'A', en: long, ca: '' } }),
        subjectSchema(() => NO_NAMES),
      ),
    );
    expect(
      tree.names
        .en()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['maxLength']);
  });
});

describe('takenSubjectNames', () => {
  const WEB: Subject = {
    id: 'web',
    name: 'Desarrollo web',
    sourceLocale: 'es',
    translations: { en: { name: 'Web development' } },
  };

  it('has the names the other subjects show in each language, without accents nor capitals', () => {
    const taken = takenSubjectNames([SUBJECT, WEB], 'web');
    expect([...taken.es]).toEqual(['programacion basica']);
    expect([...taken.en]).toEqual(['basic programming']);
    // Without its own name in Catalan, the subject shows the original
    expect([...taken.ca]).toEqual(['programacion basica']);
  });
});

describe('subjectSchema with the other subjects', () => {
  function namesOf(names: Record<'es' | 'en' | 'ca', string>) {
    const taken = takenSubjectNames([SUBJECT], null);
    return TestBed.runInInjectionContext(() =>
      form(
        signal({ sourceLocale: 'es' as const, names }),
        subjectSchema(() => taken),
      ),
    ).names;
  }

  function kindsOf(field: () => { errors: () => readonly { kind: string }[] }): string[] {
    return field()
      .errors()
      .map((error) => error.kind);
  }

  it('turns down a name another subject shows in that language', () => {
    const names = namesOf({ es: ' Programación Basica ', en: 'Basic programming', ca: 'Web' });
    expect(kindsOf(names.es)).toEqual(['taken']);
    expect(names.es().errors()[0].message).toBe('Ya hay una asignatura con ese nombre');
    expect(kindsOf(names.en)).toEqual(['taken']);
    expect(kindsOf(names.ca)).toEqual([]);
  });

  it('asks for a name that is not only spaces', () => {
    expect(kindsOf(namesOf({ es: '   ', en: '', ca: '' }).es)).toEqual(['required']);
  });
});
