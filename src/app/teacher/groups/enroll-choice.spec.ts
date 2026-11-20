import type { UserRef } from '../../data/group-service';
import { addToChoice, inBatches } from './enroll-choice';

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
