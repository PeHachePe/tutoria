import type { ClassCandidate, PreviousClass, UserRef } from '../../data/group-service';
import {
  addToChoice,
  blockerLine,
  enrollBlocker,
  inBatches,
  skippedLine,
  sortOutCandidates,
} from './enroll-choice';

const [ana, bruno, carla] = ['ana', 'bruno', 'carla'].map((id): UserRef => ({
  id,
  name: id,
  email: `${id}@tutoria.test`,
}));

describe('addToChoice', () => {
  it('adds who is neither chosen nor enrolled, after the chosen ones', () => {
    expect(addToChoice([ana], [ana, bruno, carla], new Set(['carla']))).toEqual({
      chosen: [ana, bruno],
      added: 1,
    });
  });

  it('adds nobody when all are there', () => {
    expect(addToChoice([ana], [ana], new Set()).added).toBe(0);
  });
});

describe('inBatches', () => {
  it('splits the items in pieces of the size given, in their order', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('gives no piece without items', () => {
    expect(inBatches([], 50)).toEqual([]);
  });
});

describe('who is not taken at once into a class (5.2g)', () => {
  const THIS_YEAR: PreviousClass = { name: '1.º DAM B', schoolYear: '2026/27', outcome: null };
  const LEFT: PreviousClass = { name: '2.º DAW A', schoolYear: '2025/26', outcome: 'leaves' };
  const PROMOTED: PreviousClass = { ...LEFT, outcome: 'promotes' };
  const as = (student: UserRef, previous: PreviousClass | null): ClassCandidate => ({
    student,
    previous,
  });

  it('is who is in another class of the year, or finished in their last class', () => {
    expect(enrollBlocker(as(ana, THIS_YEAR), '2026/27')).toBe('other_class');
    expect(enrollBlocker(as(ana, LEFT), '2026/27')).toBe('finished');
    expect(enrollBlocker(as(ana, PROMOTED), '2026/27')).toBeNull();
    expect(enrollBlocker(as(ana, null), '2026/27')).toBeNull();
    // One group takes a student of any class
    expect(enrollBlocker(as(ana, THIS_YEAR), null)).toBeNull();
  });

  it('keeps the others, says why of those left out, and passes over who is here', () => {
    expect(
      sortOutCandidates(
        [as(ana, THIS_YEAR), as(bruno, LEFT), as(carla, PROMOTED)],
        new Set(['ana']),
        '2026/27',
      ),
    ).toEqual({ kept: [carla], skipped: ['bruno · Baja · 2.º DAW A · 2025/26'] });
  });

  it('says where they are, or what they did', () => {
    expect(skippedLine(as(ana, THIS_YEAR), 'other_class')).toBe(
      'ana · Ya está en 1.º DAM B · 2026/27',
    );
    expect(blockerLine(PROMOTED, null)).toBe('Promociona · 2.º DAW A · 2025/26');
  });
});
