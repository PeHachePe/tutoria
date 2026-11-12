import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise, AssignedGroup, Difficulty } from '../../data/exercise';
import { findAssigned, progressSummary, searchAssigned } from './assigned-queries';

const BASIC: AssignedGroup = {
  id: 'dam',
  name: '1.º DAM B',
  subject: {
    id: 'basic',
    name: 'Programación básica',
    sourceLocale: 'es',
    translations: { en: { name: 'Basic programming' } },
  },
};
const ADVANCED: AssignedGroup = {
  id: 'dam-adv',
  name: '1.º DAM B',
  subject: { id: 'adv', name: 'Programación avanzada', sourceLocale: 'es', translations: {} },
};

function entry(
  id: string,
  title: string,
  status: AttemptStatus = 'not_started',
  {
    group = BASIC,
    block = 'Tema 1: Variables',
    topics = [] as string[],
    difficulty = 'initial' as Difficulty,
    updatedAt = null as string | null,
  } = {},
): AssignedExercise {
  return {
    exercise: {
      id,
      title,
      statement: '',
      topics,
      sourceLocale: 'es',
      translations: { en: { title: `${title} (en)`, statement: '', topics } },
      difficulty,
    } as unknown as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    group,
    block: {
      id: `${group.id}-${block}`,
      groupId: group.id,
      position: 1,
      title: block,
      sourceLocale: 'es',
      translations: {},
      isHidden: false,
    },
    updatedAt,
    status,
    hintCount: 0,
    hintLevel: null,
    practice: null,
    repetitions: 0,
  };
}

const ENTRIES = [
  entry('1', 'Suma de un vector', 'submitted'),
  entry('2', 'Contar los pares', 'passed', { block: 'Tema 2: Bucles', topics: ['bucles'] }),
  entry('3', 'Tabla de multiplicar', 'tests_failed', {
    block: 'Tema 2: Bucles',
    difficulty: 'medium',
    updatedAt: '2026-11-10T10:00:00Z',
  }),
  entry('4', 'Máximo de un vector', 'not_started', { block: 'Tema 2: Bucles' }),
  entry('5', 'Recursividad', 'in_progress', { group: ADVANCED, difficulty: 'advanced' }),
];

describe('progressSummary', () => {
  it('counts the exercises of each subject by status, and in all', () => {
    expect(progressSummary(ENTRIES, 'es')).toEqual({
      subjects: [
        {
          subject: 'Programación básica',
          group: '1.º DAM B',
          assigned: 4,
          notStarted: 1,
          inProgress: 0,
          failing: 1,
          passed: 1,
          submitted: 1,
          pending: 3,
        },
        {
          subject: 'Programación avanzada',
          group: '1.º DAM B',
          assigned: 1,
          notStarted: 0,
          inProgress: 1,
          failing: 0,
          passed: 0,
          submitted: 0,
          pending: 1,
        },
      ],
      total: {
        assigned: 5,
        notStarted: 1,
        inProgress: 1,
        failing: 1,
        passed: 1,
        submitted: 1,
        pending: 4,
      },
    });
  });

  it('names the subjects in the language of the interface and filters them by name', () => {
    const english = progressSummary(ENTRIES, 'en', 'basic');
    expect(english.subjects.map((each) => each.subject)).toEqual(['Basic programming']);
    expect(english.total.assigned).toBe(4);
    expect(progressSummary(ENTRIES, 'es', 'avanzáda').total.assigned).toBe(1);
    expect(progressSummary(ENTRIES, 'es', 'química').subjects).toEqual([]);
  });
});

describe('searchAssigned', () => {
  it('finds by words of the title, a topic, the block or the subject, accents and plurals aside', () => {
    expect(searchAssigned(ENTRIES, { text: 'bucle' }, 'es').map((each) => each.id)).toEqual([
      'a-2',
      'a-3',
      'a-4',
    ]);
    expect(searchAssigned(ENTRIES, { text: 'maximo vectores' }, 'es')[0].id).toBe('a-4');
    expect(searchAssigned(ENTRIES, { text: 'avanzada' }, 'es').map((each) => each.id)).toEqual([
      'a-5',
    ]);
  });

  it('filters by status, pending being anything not submitted, and by difficulty', () => {
    expect(searchAssigned(ENTRIES, { status: 'pending' }, 'es')).toHaveLength(4);
    expect(searchAssigned(ENTRIES, { status: 'tests_failed' }, 'es')).toEqual([
      {
        id: 'a-3',
        title: 'Tabla de multiplicar',
        block: 'Tema 2: Bucles',
        subject: 'Programación básica',
        status: 'tests_failed',
        difficulty: 'medium',
      },
    ]);
    expect(searchAssigned(ENTRIES, { difficulty: 'advanced' }, 'es')[0].id).toBe('a-5');
  });

  it('gives five by default, or the limit asked for, in the language of the interface', () => {
    expect(searchAssigned([...ENTRIES, ...ENTRIES], {}, 'en')).toHaveLength(5);
    const two = searchAssigned(ENTRIES, { limit: 2 }, 'en');
    expect(two.map((each) => each.title)).toEqual([
      'Suma de un vector (en)',
      'Contar los pares (en)',
    ]);
    expect(searchAssigned(ENTRIES, { text: 'de', limit: 10 }, 'es')).toEqual([]);
  });
});

describe('findAssigned', () => {
  it('finds the exercise the catalog suggests with next', () => {
    expect(findAssigned(ENTRIES, 'next', 'es')?.assignmentId).toBe('a-3');
    expect(findAssigned([ENTRIES[0]], 'next', 'es')).toBeNull();
  });

  it('finds by the id of the assignment or of the exercise', () => {
    expect(findAssigned(ENTRIES, 'a-4', 'es')?.assignmentId).toBe('a-4');
    expect(findAssigned(ENTRIES, '5', 'es')?.assignmentId).toBe('a-5');
  });

  it('finds by words, the pending ones before the submitted', () => {
    expect(findAssigned(ENTRIES, 'vector', 'es')?.assignmentId).toBe('a-4');
    expect(findAssigned(ENTRIES, 'suma vector', 'es')?.assignmentId).toBe('a-1');
    expect(findAssigned(ENTRIES, 'química', 'es')).toBeNull();
  });
});
