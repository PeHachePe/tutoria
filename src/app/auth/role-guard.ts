import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import type { Role } from '../data/user';
import { AuthStore } from './auth-store';

/**
 * Lets the given roles match the route (2.2). Without a session it sends the user to the login;
 * with another role the route does not exist for them, so the navigation ends in the not found page.
 */
export function roleGuard(...roles: Role[]): CanMatchFn {
  return () => {
    const role = inject(AuthStore).role();
    if (!role) {
      return inject(Router).createUrlTree(['/login']);
    }
    return roles.includes(role);
  };
}
