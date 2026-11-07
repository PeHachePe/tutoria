import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';

import type { Role } from '../data/user';
import { AuthStore } from './auth-store';

const HOME_PATHS: Record<Role, string> = {
  student: '/alumno',
  teacher: '/docente/en-vivo',
  admin: '/admin/usuarios',
};

/** First screen of each role: where `/` and a signed-in visit to `/login` lead. */
export function homePath(role: Role): string {
  return HOME_PATHS[role];
}

/** `redirectTo` of the root: the home of the signed-in role, or the login without a session. */
export const homeRedirect: RedirectFunction = () => {
  const role = inject(AuthStore).role();
  return role ? homePath(role) : '/login';
};
