import type { AttemptStatus } from '../../data/attempt';
import type { LiveExercise, LiveStudent } from '../../data/live-service';
import { EXERCISES } from '../../data/mock/fixtures/exercises';
import type { ClassStrip, StripStatus } from '../../teacher/live/class-strip';
import type { ClassOverview } from '../../teacher/live/live-overview';

/** Where 24 students are in a block of 12 exercises, for «Dónde está la clase» in /dev/ui. */
const PLACES: readonly (readonly [number, StripStatus])[] = [
  [2, 'tests_failed'],
  ...Array.from({ length: 6 }, () => [8, 'in_progress'] as const),
  ...Array.from({ length: 5 }, () => [9, 'tests_failed'] as const),
  ...Array.from({ length: 4 }, () => [9, 'in_progress'] as const),
  ...Array.from({ length: 3 }, () => [10, 'in_progress'] as const),
  ...Array.from({ length: 4 }, () => [7, 'submitted'] as const),
  [12, 'passed'],
];

const NAMES = ['Hugo', 'Aya', 'Lía', 'Max', 'Noa', 'Pau', 'Rut', 'Sam', 'Teo', 'Uxue'];

const exercises: LiveExercise[] = Array.from({ length: 12 }, (_, index) => ({
  assignmentId: `sample-${index + 1}`,
  blockId: 'sample',
  exercise: EXERCISES[index % EXERCISES.length],
  tests: [],
}));

const students: LiveStudent[] = PLACES.map((_, index) => ({
  id: `student-${index}`,
  name:
    index === 0
      ? 'Hugo Martín'
      : index === PLACES.length - 1
        ? 'Lía Gómez'
        : NAMES[index % NAMES.length],
}));

export const SAMPLE_STRIP: ClassStrip = {
  columns: exercises.map((exercise, index) => {
    const here = PLACES.filter(([position]) => position === index + 1);
    const count = (status: StripStatus) => here.filter(([, s]) => s === status).length;
    return {
      exercise,
      position: index + 1,
      total: here.length,
      counts: {
        in_progress: count('in_progress'),
        tests_failed: count('tests_failed'),
        passed: count('passed'),
        submitted: count('submitted'),
      },
    };
  }),
  bulk: { from: 8, to: 9 },
  outliers: [
    { position: 2, side: 'behind', names: ['Hugo'] },
    { position: 12, side: 'ahead', names: ['Lía'] },
  ],
};

export const SAMPLE_OVERVIEW: ClassOverview = {
  elsewhere: [],
  exercises: exercises.map((exercise, index) => {
    const at = (status: AttemptStatus) =>
      students.filter((_, i) => PLACES[i][0] === index + 1 && PLACES[i][1] === status);
    const done = students.filter((_, i) => PLACES[i][0] > index + 1);
    const ahead = students.filter((_, i) => PLACES[i][0] < index + 1);
    const byStatus: Record<AttemptStatus, readonly LiveStudent[]> = {
      not_started: ahead,
      in_progress: at('in_progress'),
      tests_failed: at('tests_failed'),
      passed: at('passed'),
      submitted: [...done, ...at('submitted')],
    };
    return {
      exercise,
      position: index + 1,
      students: byStatus,
      total: students.length,
      topFailure: null,
    };
  }),
};
