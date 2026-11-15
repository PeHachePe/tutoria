import type { Exercise } from '../../data/exercise';
import type { AppUser } from '../../data/user';

/**
 * Whether the user may change or delete an exercise of the bank: its author or the administration,
 * as the RLS says (D-057). The others read it and duplicate it.
 */
export function canEditExercise(exercise: Exercise, user: AppUser | null): boolean {
  return user !== null && (user.role === 'admin' || exercise.createdBy === user.id);
}
