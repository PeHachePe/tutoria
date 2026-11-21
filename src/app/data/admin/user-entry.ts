import type { UserEntry } from '../admin-service';
import type { PreviousClass } from '../group-service';
import type { AppUser } from '../user';

/**
 * An account with what ties it to the classes, from the names of the groups it teaches and of those
 * it is enrolled in, and the classes it was a student of (5.2g): the mock data and Supabase build it
 * the same way.
 */
export function toUserEntry(
  user: AppUser,
  taught: readonly string[],
  enrolledIn: readonly string[],
  classes: readonly PreviousClass[] = [],
): UserEntry {
  return {
    user,
    groupNames: [...new Set([...taught, ...enrolledIn])].sort((a, b) => a.localeCompare(b, 'es')),
    links: { groups: taught.length, enrollments: enrolledIn.length },
    classes: [...classes].sort(
      (a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.name.localeCompare(b.name, 'es'),
    ),
  };
}
