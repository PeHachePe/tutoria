import type { UserEntry } from '../../data/admin-service';

/**
 * Why the role of an account cannot change, said before trying (CU-06 3b, D-072), or null. The
 * same rules as `userChangeProblem()`, which the server applies anyway.
 */
export function roleLock(
  { user, groupNames, links }: UserEntry,
  callerId: string | undefined,
): string | null {
  if (user.id === callerId) {
    return $localize`:@@users.own.hint:No puedes quitarte tu propio rol ni desactivarte: la aplicación se quedaría sin administración.`;
  }
  const groups = groupNames.join(', ');
  if (links.groups > 0) {
    return $localize`:@@users.role.taught:Tiene a su cargo ${groups}:groups:: reasigna sus grupos antes de cambiarle el rol.`;
  }
  if (links.enrollments > 0) {
    return $localize`:@@users.role.enrolled:Tiene matrícula en ${groups}:groups:: dale de baja de sus grupos antes de cambiarle el rol.`;
  }
  return null;
}
