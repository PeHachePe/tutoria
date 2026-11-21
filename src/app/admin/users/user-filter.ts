import type { UserEntry } from '../../data/admin-service';
import type { Role, UserStatus } from '../../data/user';
import { isFinished } from '../../shared/class-outcome';
import { searchable } from '../../shared/searchable';

/**
 * Where a student is (5.2g): in a class this year, without one, or finished the cycle or left the
 * school in their last class, as the final evaluation says.
 */
export type StudentSituation = 'in_class' | 'no_class' | 'finished';

/** The filters of the users (5.1b), which live in the URL of the screen. */
export interface UserFilters {
  readonly search: string;
  /** One role, or null for all of them. */
  readonly role: Role | null;
  /** The accounts of one status, or `all` of them. */
  readonly status: UserStatus | 'all';
  /** The students in one situation (5.2g), or null for every account. */
  readonly situation: StudentSituation | null;
}

/** The active accounts: those the administration usually looks for. */
export const NO_USER_FILTERS: UserFilters = {
  search: '',
  role: null,
  status: 'active',
  situation: null,
};

/**
 * The situation of a student this year, or null for a teacher or the administration. Who finished
 * in their last class is finished, also this year: it is what the notice to disable them counts.
 */
export function studentSituation(
  { user, classes }: UserEntry,
  currentSchoolYear: string,
): StudentSituation | null {
  if (user.role !== 'student') return null;
  const [last] = classes;
  if (last && isFinished(last.outcome)) return 'finished';
  return classes.some(({ schoolYear }) => schoolYear === currentSchoolYear)
    ? 'in_class'
    : 'no_class';
}

/** Accounts per page: a table that fits on a screen. */
export const USERS_PAGE_SIZE = 10;

/**
 * The accounts that pass every filter, in the order they come. The search looks for every word in
 * the name and the email, without accents nor capitals: «ibanez» finds «Marta Ibáñez Soler».
 */
export function filterUsers(
  entries: readonly UserEntry[],
  filters: UserFilters,
  currentSchoolYear: string,
): UserEntry[] {
  const words = searchable(filters.search).split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (filters.status === 'all' || entry.user.status === filters.status) &&
      (filters.role === null || entry.user.role === filters.role) &&
      (filters.situation === null ||
        studentSituation(entry, currentSchoolYear) === filters.situation) &&
      words.every((word) => searchable(`${entry.user.name} ${entry.user.email}`).includes(word)),
  );
}
