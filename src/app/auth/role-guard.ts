import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { APP_PATHS, REDIRECT_PARAM } from '../core/app-paths';
import type { Role } from '../data/user';
import { AuthStore } from './auth-store';

/**
 * Lets the given roles match the route (2.2). Without a session it sends the user to the login,
 * with the page asked for in `?redirect=` so the login can come back to it (afterSignInPath); with
 * another role the route does not exist for them, so the navigation ends in the not found page.
 */
export function roleGuard(...roles: Role[]): CanMatchFn {
  return (_route, segments, { queryParams }) => {
    const role = inject(AuthStore).role();
    if (!role) {
      const router = inject(Router);
      const asked = router.createUrlTree(
        segments.map((segment) => segment.path),
        { queryParams },
      );
      return router.createUrlTree([APP_PATHS.login], {
        queryParams: { [REDIRECT_PARAM]: router.serializeUrl(asked) },
      });
    }
    return roles.includes(role);
  };
}
