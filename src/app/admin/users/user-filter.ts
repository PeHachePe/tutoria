import type { UserEntry } from '../../data/admin-service';
import type { Role, UserStatus } from '../../data/user';
import { searchable } from '../../shared/searchable';

/** The filters of the users (5.1b), which live in the URL of the screen. */
export interface UserFilters {
  readonly search: string;
  /** One role, or null for all of them. */
  readonly role: Role | null;
  /** The accounts of one status, or `all` of them. */
  readonly status: UserStatus | 'all';
}

/** The active accounts: those the administration usually looks for. */
export const NO_USER_FILTERS: UserFilters = { search: '', role: null, status: 'active' };

/** Accounts per page: a table that fits on a screen. */
export const USERS_PAGE_SIZE = 10;

/**
 * The accounts that pass every filter, in the order they come. The search looks for every word in
 * the name and the email, without accents nor capitals: «ibanez» finds «Marta Ibáñez Soler».
 */
export function filterUsers(entries: readonly UserEntry[], filters: UserFilters): UserEntry[] {
  const words = searchable(filters.search).split(/\s+/).filter(Boolean);
  return entries.filter(
    ({ user }) =>
      (filters.status === 'all' || user.status === filters.status) &&
      (filters.role === null || user.role === filters.role) &&
      words.every((word) => searchable(`${user.name} ${user.email}`).includes(word)),
  );
}
