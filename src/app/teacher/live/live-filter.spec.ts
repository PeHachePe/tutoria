import {
  filterRows,
  type FilterCriteria,
  liveFilterOf,
  LIVE_FILTER_PARAMS,
  studentsOf,
} from './live-filter';
import type { ClassOverview } from './live-overview';
import { BLOCK_EXERCISES, STUDENTS, testRow } from './live-testing';

const [ana, bea, cai] = STUDENTS;
const rows = [
  testRow({ student: { id: 'alv', name: 'Álvaro Ruiz' }, work: 'working' }),
  testRow({ student: ana, work: 'stopped' }),
  testRow({ student: bea, work: 'absent' }),
  testRow({ student: cai, work: 'working' }),
];

const names = (criteria: Partial<FilterCriteria>) =>
  filterRows(rows, {
    filter: 'all',
    search: '',
    queuedIds: new Set(['cai']),
    finishedIds: new Set(['ana', 'cai']),
    startedIds: new Set(['alv']),
    studentIds: null,
    ...criteria,
  }).map((row) => row.student.name);

describe('filterRows', () => {
  it('keeps everybody with all', () => {
    expect(names({})).toEqual(['Álvaro Ruiz', 'Ana', 'Bea', 'Cai']);
  });

  it('keeps whoever is in the queue with help', () => {
    expect(names({ filter: 'help' })).toEqual(['Cai']);
  });

  it('keeps whoever works now with working', () => {
    expect(names({ filter: 'working' })).toEqual(['Álvaro Ruiz', 'Cai']);
  });

  it('keeps whoever is not working with idle: stopped or not in yet', () => {
    expect(names({ filter: 'idle' })).toEqual(['Ana', 'Bea']);
  });

  it('keeps whoever finished or started with their filters', () => {
    expect(names({ filter: 'finished' })).toEqual(['Ana', 'Cai']);
    expect(names({ filter: 'started' })).toEqual(['Álvaro Ruiz']);
  });

  it('searches the name without accents nor capitals', () => {
    expect(names({ search: ' ALVARO ' })).toEqual(['Álvaro Ruiz']);
  });

  it('keeps only the students of a segment or a test', () => {
    expect(names({ studentIds: new Set(['bea', 'cai']) })).toEqual(['Bea', 'Cai']);
  });

  it('puts the filter, the search and the students together', () => {
    expect(names({ filter: 'finished', search: 'a', studentIds: new Set(['ana', 'bea']) })).toEqual(
      ['Ana'],
    );
  });
});

describe('studentsOf', () => {
  const overview: ClassOverview = {
    elsewhere: [],
    exercises: [
      {
        exercise: BLOCK_EXERCISES[0],
        position: 1,
        total: 3,
        students: {
          not_started: [],
          in_progress: [ana],
          tests_failed: [bea, cai],
          passed: [],
          submitted: [],
        },
        topFailure: { test: BLOCK_EXERCISES[0].tests[1], students: [bea, cai] },
      },
    ],
  };

  it('gives the students of a segment', () => {
    const ids = studentsOf(overview, { assignmentId: 'as1', status: 'in_progress', testId: null });

    expect([...ids]).toEqual(['ana']);
  });

  it('gives whoever fails the test, while it is the one failing most', () => {
    const test = BLOCK_EXERCISES[0].tests[1].id;

    expect([
      ...studentsOf(overview, { assignmentId: 'as1', status: 'tests_failed', testId: test }),
    ]).toEqual(['bea', 'cai']);
    expect(
      studentsOf(overview, { assignmentId: 'as1', status: 'tests_failed', testId: 'other' }).size,
    ).toBe(0);
  });

  it('gives nobody for an exercise the chart no longer shows', () => {
    expect(
      studentsOf(overview, { assignmentId: 'as9', status: 'in_progress', testId: null }).size,
    ).toBe(0);
  });
});

describe('liveFilterOf', () => {
  it('reads the filter of the URL', () => {
    expect(liveFilterOf(LIVE_FILTER_PARAMS.help)).toBe('help');
    expect(liveFilterOf(LIVE_FILTER_PARAMS.idle)).toBe('idle');
  });

  it('is all without it or with anything else', () => {
    expect(liveFilterOf(undefined)).toBe('all');
    expect(liveFilterOf('nonsense')).toBe('all');
  });
});
