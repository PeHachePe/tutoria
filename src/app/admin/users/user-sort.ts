import type { Sort } from '@angular/material/sort';

import type { UserEntry } from '../../data/admin-service';
import type { Role } from '../../data/user';
import { ROLES } from './role-labels';

/** The sortable columns of the table (5.1b). */
export type UserColumn = 'name' | 'role' | 'groups';

/** After every group name, so the accounts without groups go last from A to Z. */
const NO_GROUPS = '￿';

/** By name, as the service lists them. */
export function byName(a: UserEntry, b: UserEntry): number {
  return a.user.name.localeCompare(b.user.name, 'es');
}

const COMPARE: Record<UserColumn, (a: UserEntry, b: UserEntry) => number> = {
  name: byName,
  role: (a, b) => rank(a.user.role) - rank(b.user.role),
  groups: (a, b) =>
    (a.groupNames[0] ?? NO_GROUPS).localeCompare(b.groupNames[0] ?? NO_GROUPS, 'es'),
};

function rank(role: Role): number {
  return ROLES.indexOf(role);
}

/**
 * The accounts in the order of a header of the table: by name when none is chosen, and by name,
 * from A to Z, inside the same role or group whichever way it goes.
 */
export function sortUsers(entries: readonly UserEntry[], sort: Sort): UserEntry[] {
  const column = sort.direction === '' ? 'name' : (sort.active as UserColumn);
  const compare = COMPARE[column] ?? byName;
  const sign = sort.direction === 'desc' ? -1 : 1;
  return [...entries].sort((a, b) => sign * compare(a, b) || byName(a, b));
}
