import type { UserRef } from '../../data/group-service';
import { addToChoice } from './enroll-choice';

const [ana, bruno, carla, dani] = ['ana', 'bruno', 'carla', 'dani'].map((id): UserRef => ({
  id,
  name: id,
  email: `${id}@tutoria.test`,
}));

describe('addToChoice', () => {
  it('adds who is neither chosen nor enrolled, after the chosen ones', () => {
    expect(addToChoice([ana], [ana, bruno, carla], new Set(['carla']), 50)).toEqual({
      chosen: [ana, bruno],
      added: 1,
    });
  });

  it('stops at the maximum', () => {
    expect(addToChoice([ana], [bruno, carla, dani], new Set(), 2)).toEqual({
      chosen: [ana, bruno],
      added: 1,
    });
    expect(addToChoice([ana, bruno], [carla], new Set(), 2).added).toBe(0);
  });
});
