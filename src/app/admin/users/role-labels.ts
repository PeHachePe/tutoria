import type { Role } from '../../data/user';

/** Each role as the administration reads it (5.1b), collective and without gender; also for 5.2b. */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  student: $localize`:@@role.student:Alumnado`,
  teacher: $localize`:@@role.teacher:Profesorado`,
  admin: $localize`:@@role.admin:Administración`,
};

/** The roles in the order the selects offer them: from the most common account. */
export const ROLES: readonly Role[] = ['student', 'teacher', 'admin'];
