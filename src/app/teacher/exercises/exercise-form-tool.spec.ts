import { checkToolArguments } from '../../data/tutor/tutor-tools';
import { emptyFormModel } from './exercise-form-model';
import { FILL_EXERCISE_FORM, fillFormModel, subjectsByName } from './exercise-form-tool';

describe('the exercise form as a tool', () => {
  const model = emptyFormModel('es');

  it('fills the texts in the tab of their language, which becomes the original', () => {
    const filled = fillFormModel(model, {
      language: 'en',
      title: 'Count words',
      statement: 'Write `countWords(text)`.',
      topics: ['Strings', 'loops'],
    });

    expect(filled.sourceLocale).toBe('en');
    expect(filled.texts.en).toEqual({
      title: 'Count words',
      statement: 'Write `countWords(text)`.',
      topics: 'Strings, loops',
    });
    expect(filled.texts.es).toEqual(model.texts.es);
  });

  it('fills the code, the tests and the thresholds as the form writes them', () => {
    const filled = fillFormModel(model, {
      difficulty: 'medium',
      subjectIds: ['s1'],
      functionName: 'countWords',
      parameters: ['text'],
      tests: [
        { arguments: '"a b"', expected: '2' },
        { arguments: '""', expected: '0', hidden: true },
      ],
      maxRepeatedFailures: 5,
      maxIdleMinutes: 10,
    });

    expect(filled).toMatchObject({
      difficulty: 'medium',
      subjectIds: ['s1'],
      functionName: 'countWords',
      parameters: 'text',
      tests: [
        { input: '"a b"', expected: '2', isHidden: false },
        { input: '""', expected: '0', isHidden: true },
      ],
      maxRepeatedFailures: 5,
      maxIdleMinutes: 10,
    });
  });

  it('leaves as it is what it is not given', () => {
    expect(fillFormModel(model, {})).toEqual(model);
  });

  it('finds the subjects by name, without minding case or accents', () => {
    const subjects = [
      { id: 'basic', name: 'Programación básica' },
      { id: 'web', name: 'Desarrollo web' },
    ];

    expect(
      subjectsByName(['programacion BASICA', 'Programación básica', 'Física'], subjects),
    ).toEqual({ ids: ['basic'], unknown: ['Física'] });
  });

  it('has a schema the arguments are checked against', () => {
    const schema = FILL_EXERCISE_FORM.inputSchema;

    expect(
      checkToolArguments(schema, { title: 'Suma', tests: [{ arguments: '1', expected: '1' }] }).ok,
    ).toBe(true);
    expect(checkToolArguments(schema, { tests: [] }).ok).toBe(false);
    expect(checkToolArguments(schema, { difficulty: 'easy' }).ok).toBe(false);
    expect(checkToolArguments(schema, { save: true }).ok).toBe(false);
  });
});
