import type { ExerciseWithTests } from '../../data/exercise-service';
import { exerciseId } from '../../data/mock/fixtures/exercises';
import { SEED } from '../../data/mock/fixtures/seed';
import { BASIC_PROGRAMMING_ID } from '../../data/mock/fixtures/subjects';
import {
  copyFormModel,
  emptyFormModel,
  emptyTest,
  type ExerciseFormModel,
  formatJson,
  parseArguments,
  parseValue,
  previewContent,
  solutionSkeleton,
  splitList,
  textFieldsOf,
  toDraft,
  toExerciseText,
  toFormModel,
  toSolutionCheck,
} from './exercise-form-model';

const SUM_EXERCISE = SEED.exercises.find((exercise) => exercise.functionName === 'sum');
const SUM_ID = SUM_EXERCISE?.id ?? exerciseId(1);

const SUM: ExerciseWithTests = {
  exercise: SUM_EXERCISE ?? SEED.exercises[0],
  tests: SEED.tests.filter((test) => test.exerciseId === SUM_ID),
  subjectIds: [BASIC_PROGRAMMING_ID],
  studentCount: 0,
  groups: [],
};

describe('exercise form model', () => {
  describe('formatJson', () => {
    it('writes JSON values with a space after commas and colons', () => {
      expect(formatJson([1, 2, 3])).toBe('[1, 2, 3]');
      expect(formatJson({ name: 'Ana', tags: ['a'] })).toBe('{"name": "Ana", "tags": ["a"]}');
      expect(formatJson('hola')).toBe('"hola"');
      expect(formatJson(null)).toBe('null');
      expect(formatJson([])).toBe('[]');
      expect(formatJson({})).toBe('{}');
    });
  });

  describe('parseArguments', () => {
    it('reads the arguments as they go in the call, separated by commas', () => {
      expect(parseArguments('[1, 2, 3]')).toEqual([[1, 2, 3]]);
      expect(parseArguments('"hola", 3')).toEqual(['hola', 3]);
      expect(parseArguments('  ')).toEqual([]);
    });

    it('is undefined for what is not JSON', () => {
      expect(parseArguments('hola')).toBeUndefined();
      expect(parseArguments('[1, 2')).toBeUndefined();
    });
  });

  describe('parseValue', () => {
    it('reads one JSON value, null included', () => {
      expect(parseValue('6')).toEqual({ value: 6 });
      expect(parseValue('null')).toEqual({ value: null });
      expect(parseValue(' "a" ')).toEqual({ value: 'a' });
    });

    it('is undefined for an empty text or what is not JSON', () => {
      expect(parseValue('')).toBeUndefined();
      expect(parseValue('hola')).toBeUndefined();
      expect(parseValue('1, 2')).toBeUndefined();
    });
  });

  it('splits a list written with commas, without blanks', () => {
    expect(splitList(' Bucles,  acumulador , ,')).toEqual(['Bucles', 'acumulador']);
    expect(splitList('')).toEqual([]);
  });

  it('gives a new object for each empty test, as Signal Forms tells them apart by identity', () => {
    expect(emptyTest()).toEqual({ input: '', expected: '', isHidden: false });
    expect(emptyTest()).not.toBe(emptyTest());
  });

  it('starts a new exercise in the language of the interface, with one empty test', () => {
    const model = emptyFormModel('ca');

    expect(model.sourceLocale).toBe('ca');
    expect(model.texts.ca).toEqual({ title: '', statement: '', topics: '' });
    expect(model.difficulty).toBe('initial');
    expect(model.maxRepeatedFailures).toBe(3);
    expect(model.maxIdleMinutes).toBe(4);
    expect(model.tests).toEqual([{ input: '', expected: '', isHidden: false }]);
  });

  it('turns an exercise into the model of the form, a tab per language', () => {
    const model = toFormModel(SUM);

    expect(model.sourceLocale).toBe('es');
    expect(model.texts.es.title).toBe(SUM.exercise.title);
    expect(model.texts.en.title).toBe(SUM.exercise.translations.en?.title);
    expect(model.texts.es.topics).toBe(SUM.exercise.topics.join(', '));
    expect(model.functionName).toBe('sum');
    expect(model.parameters).toBe('numbers');
    expect(model.subjectIds).toEqual([BASIC_PROGRAMMING_ID]);
    expect(model.tests[0]).toEqual({
      input: formatJson(SUM.tests[0].input[0]),
      expected: formatJson(SUM.tests[0].expectedOutput),
      isHidden: false,
    });
    expect(model.tests.at(-1)?.isHidden).toBe(true);
  });

  it('leaves empty the tab of a language without translation', () => {
    const model = toFormModel({
      ...SUM,
      exercise: { ...SUM.exercise, translations: {} },
    });

    expect(model.texts.en).toEqual({ title: '', statement: '', topics: '' });
  });

  it('copies an exercise as a new one, its titles marked as a copy', () => {
    const model = copyFormModel(SUM);

    expect(model.texts.es.title).toBe(`${SUM.exercise.title} (copia)`);
    expect(model.texts.en.title).toBe(`${SUM.exercise.translations.en?.title} (copy)`);
    expect(model.texts.ca.title).toBe(`${SUM.exercise.translations.ca?.title} (còpia)`);
    expect(model.tests).toEqual(toFormModel(SUM).tests);
  });

  it('leaves empty the title of a copy in a language without translation', () => {
    const model = copyFormModel({ ...SUM, exercise: { ...SUM.exercise, translations: {} } });

    expect(model.texts.en.title).toBe('');
  });

  it('never loses a test, even one written wrong (the schema stops it before)', () => {
    const draft = toDraft({
      ...emptyFormModel('es'),
      tests: [{ input: 'hola', expected: 'hola', isHidden: false }],
    });

    expect(draft.tests).toEqual([
      { input: [], expectedOutput: null, isHidden: false, position: 0 },
    ]);
  });

  it('turns the model back into the exercise it came from', () => {
    const draft = toDraft(toFormModel(SUM));

    expect(draft).toEqual({
      title: SUM.exercise.title,
      statement: SUM.exercise.statement,
      difficulty: SUM.exercise.difficulty,
      topics: SUM.exercise.topics,
      sourceLocale: 'es',
      translations: SUM.exercise.translations,
      functionName: 'sum',
      parameters: ['numbers'],
      maxRepeatedFailures: SUM.exercise.maxRepeatedFailures,
      maxIdleMinutes: SUM.exercise.maxIdleMinutes,
      subjectIds: [BASIC_PROGRAMMING_ID],
      tests: SUM.tests.map(({ input, expectedOutput, isHidden, position }) => ({
        input,
        expectedOutput,
        isHidden,
        position,
      })),
    });
  });

  it('previews the exercise of the form as the statement zone shows it', () => {
    const content = previewContent(toFormModel(SUM));

    expect(content.exercise).toMatchObject({
      id: 'preview',
      title: SUM.exercise.title,
      functionName: 'sum',
      language: 'javascript',
    });
    expect(content.visibleTests.map((test) => test.input)).toEqual(
      SUM.tests.filter((test) => !test.isHidden).map((test) => test.input),
    );
    expect(content.hiddenTestCount).toBe(SUM.tests.filter((test) => test.isHidden).length);
  });

  it('keeps only the translations with some text, and trims every text', () => {
    const model: ExerciseFormModel = {
      ...emptyFormModel('es'),
      texts: {
        es: { title: ' Producto ', statement: ' Escribe… ', topics: 'Vectores' },
        en: { title: 'Product', statement: 'Write…', topics: '' },
        ca: { title: ' ', statement: '', topics: '' },
      },
      functionName: ' product ',
      parameters: 'numbers, factor',
      tests: [{ input: '[2, 3], 2', expected: '12', isHidden: false }],
    };

    const draft = toDraft(model);

    expect(draft).toMatchObject({
      title: 'Producto',
      statement: 'Escribe…',
      topics: ['Vectores'],
      translations: { en: { title: 'Product', statement: 'Write…', topics: [] } },
      functionName: 'product',
      parameters: ['numbers', 'factor'],
      tests: [{ input: [[2, 3], 2], expectedOutput: 12, isHidden: false, position: 0 }],
    });
  });

  describe('the solution of the teacher (4.3c)', () => {
    it('is checked against the tests of the form as they are, without saving them', () => {
      const model = toFormModel(SUM);

      expect(toSolutionCheck({ ...model, functionName: ' sum ' }, 'function sum() {}')).toEqual({
        code: 'function sum() {}',
        functionName: 'sum',
        tests: SUM.tests.map(({ input, expectedOutput, isHidden }) => ({
          input,
          expectedOutput,
          isHidden,
        })),
      });
    });

    it('starts from the skeleton the tutor gives', () => {
      expect(
        solutionSkeleton({ ...emptyFormModel('es'), functionName: 'add', parameters: 'a, b' }),
      ).toBe('function add(a, b) {\n}');
    });
  });

  describe('the texts of a language', () => {
    it('go to and from the fields of a tab', () => {
      const text = { title: ' Suma ', statement: 'Suma `values`.', topics: ['Bucles', 'arrays'] };

      expect(textFieldsOf(text)).toEqual({
        title: ' Suma ',
        statement: 'Suma `values`.',
        topics: 'Bucles, arrays',
      });
      expect(toExerciseText(textFieldsOf(text))).toEqual({ ...text, title: 'Suma' });
    });
  });
});
