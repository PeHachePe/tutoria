import type { UserEntry } from '../admin-service';
import type { AppUser } from '../user';

/**
 * An account with what ties it to the classes, from the names of the groups it teaches and of those
 * it is enrolled in: the mock data and Supabase build it the same way.
 */
export function toUserEntry(
  user: AppUser,
  taught: readonly string[],
  enrolledIn: readonly string[],
): UserEntry {
  return {
    user,
    groupNames: [...new Set([...taught, ...enrolledIn])].sort((a, b) => a.localeCompare(b, 'es')),
    links: { groups: taught.length, enrollments: enrolledIn.length },
  };
}
