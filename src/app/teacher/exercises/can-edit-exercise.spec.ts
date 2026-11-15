import { SEED } from '../../data/mock/fixtures/seed';
import { ADMIN_ID, OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { canEditExercise } from './can-edit-exercise';

const MARTAS = SEED.exercises[0];
const userOf = (id: string) => SEED.users.find((user) => user.id === id) ?? null;

describe('canEditExercise', () => {
  it('lets the author and the administration edit, nobody else', () => {
    expect(MARTAS.createdBy).toBe(TEACHER_ID);
    expect(canEditExercise(MARTAS, userOf(TEACHER_ID))).toBe(true);
    expect(canEditExercise(MARTAS, userOf(ADMIN_ID))).toBe(true);
    expect(canEditExercise(MARTAS, userOf(OTHER_TEACHER_ID))).toBe(false);
    expect(canEditExercise(MARTAS, null)).toBe(false);
  });
});
