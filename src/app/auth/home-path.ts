import { inject } from '@angular/core';
import { RedirectFunction } from '@angular/router';

import { APP_PATHS } from '../core/app-paths';
import type { Role } from '../data/user';
import { AuthStore } from './auth-store';

const HOME_PATHS: Record<Role, string> = {
  student: APP_PATHS.student.catalog,
  teacher: APP_PATHS.teacher.live,
  admin: APP_PATHS.admin.users,
};

/** First screen of each role: where `/` and a signed-in visit to `/login` lead. */
export function homePath(role: Role): string {
  return HOME_PATHS[role];
}

/** `redirectTo` of the root: the home of the signed-in role, or the login without a session. */
export const homeRedirect: RedirectFunction = () => {
  const role = inject(AuthStore).role();
  return role ? homePath(role) : APP_PATHS.login;
};
